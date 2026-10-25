// Motor de Arkanoid portado de references/started-games/04-arkanoid/game.js.
// Recibe un <canvas> y avisa a React por callbacks; no conoce React ni el DOM global.

import type {
  GameCallbacks,
  GameEngine,
  GameStats,
  VirtualButton,
} from "../engine";

import { LEVELS, LEVEL_CHARS, type BlockColor } from "./levels";
import { Renderer } from "./render";
import {
  SKIN_NAMES,
  THEMES,
  THEME_NAMES,
  type ArkanoidSkin,
  type ArkanoidTheme,
} from "./skins";
import { EXPLOSION_DURATION, loadSpritesheet } from "./sprites";

export type { ArkanoidSkin, ArkanoidTheme };

export interface ArkanoidOptions {
  muted: boolean;
  skin: ArkanoidSkin;
  theme: ArkanoidTheme;
}

const DEFAULT_SKIN: ArkanoidSkin = "classic";
const DEFAULT_THEME: ArkanoidTheme = "dark";

const SOUND_BASE = "/games/bloque-buster/sounds/";

export const W = 800;
export const H = 600;

const PADDLE_SPEED = 600; // px/s
const MAX_BOUNCE_ANGLE = 60; // grados desde la vertical
const START_LIVES = 3;
const BLOCK_W = 64;
const BLOCK_H = 32; // sprite 32x16 al doble
const GRID_COLS = 10;
const GRID_X = 80;
const GRID_Y = 60; // 10 * 64 = 640 -> márgenes laterales de 80 px
const MAX_DT = 0.05; // s, evita saltos tras un lag
const MAX_STEP_PX = 8; // máximo recorrido de la bola por sub-paso
const LAUNCH_SPREAD = 15; // grados desde la vertical, al azar a cada lado

// Teclas que el motor captura. Las flechas y Space llevan preventDefault
// (evitan el scroll de la página); A y D no desplazan nada.
const PREVENT_KEYS = new Set([
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "Space",
]);
const GAME_KEYS = new Set([...PREVENT_KEYS, "KeyA", "KeyD"]);

type State = "ready" | "playing" | "gameover";

interface Block {
  x: number;
  y: number;
  color: BlockColor;
  hits: number;
  points: number;
  alive: boolean;
}

interface Explosion {
  x: number;
  y: number;
  color: BlockColor;
  start: number; // ms (performance.now)
}

export class ArkanoidEngine implements GameEngine {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly callbacks: GameCallbacks;

  private readonly renderer: Renderer;
  private skin: ArkanoidSkin;
  private theme: ArkanoidTheme;
  private keys = new Set<string>();
  private padHeld = new Set<VirtualButton>(); // botones del gamepad táctil, aparte del teclado

  private state: State = "ready";
  private level = 1;
  private score = 0;
  private lives = START_LIVES;
  private paddle = { x: (W - 162) / 2, y: H - 40, w: 162, h: 14 };
  private ball = { x: W / 2, y: H - 40 - 8, vx: 0, vy: 0, r: 8 };
  private blocks: Block[] = [];
  private explosions: Explosion[] = [];

  private pausedAt: number | null = null; // performance.now() al pausar
  private lastStats: GameStats | null = null;
  private gameOverEmitted = false;

  private muted: boolean;
  private readonly bounceSound: HTMLAudioElement;
  private readonly breakSound: HTMLAudioElement;

  private started = false;
  private paused = false;
  private destroyed = false;
  private listening = false;
  private rafId: number | null = null;
  private lastTime: number | null = null;

  constructor(
    canvas: HTMLCanvasElement,
    callbacks: GameCallbacks,
    options?: Partial<ArkanoidOptions>,
  ) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D no disponible");
    this.canvas = canvas;
    this.ctx = ctx;
    this.callbacks = callbacks;
    this.canvas.width = W;
    this.canvas.height = H;
    this.blocks = this.createBlocks();
    this.muted = options?.muted === true;
    this.skin = SKIN_NAMES.includes(options?.skin as ArkanoidSkin)
      ? (options!.skin as ArkanoidSkin)
      : DEFAULT_SKIN;
    this.theme = THEME_NAMES.includes(options?.theme as ArkanoidTheme)
      ? (options!.theme as ArkanoidTheme)
      : DEFAULT_THEME;
    this.renderer = new Renderer(ctx, this.skin, THEMES[this.skin][this.theme]);
    this.bounceSound = new Audio(`${SOUND_BASE}ball-bounce.mp3`);
    this.breakSound = new Audio(`${SOUND_BASE}break-sound.mp3`);
  }

  // Aplica en vivo, también en pausa o con la partida terminada.
  setMuted(muted: boolean) {
    this.muted = muted === true;
    if (this.muted) this.stopSounds();
  }

  // Solo cambia el dibujo; con el loop parado (pausa, fin) se repinta al momento.
  setSkin(skin: ArkanoidSkin) {
    if (!SKIN_NAMES.includes(skin)) return;
    this.skin = skin;
    this.applyLook();
  }

  setTheme(theme: ArkanoidTheme) {
    if (!THEME_NAMES.includes(theme)) return;
    this.theme = theme;
    this.applyLook();
  }

  private applyLook() {
    this.renderer.skin = this.skin;
    this.renderer.t = THEMES[this.skin][this.theme];
    if (this.started && !this.destroyed && this.rafId === null) this.draw();
  }

  // ── Ciclo de vida ───────────────────────────────────────────────────────────

  start() {
    if (this.destroyed || this.started) return;
    this.started = true;
    this.resetGame();
    this.addListeners();
    // Solo el skin `arcade` usa el spritesheet: el juego no espera a que cargue.
    this.startLoop();
    loadSpritesheet()
      .then((img) => {
        // destroy() pudo llegar mientras cargaba la imagen
        if (this.destroyed) return;
        this.renderer.img = img;
        if (this.rafId === null) this.draw();
      })
      .catch((err) => console.error(err));
  }

  pause() {
    if (this.destroyed || this.paused) return;
    this.paused = true;
    this.pausedAt = performance.now();
    // Una tecla soltada durante la pausa se quedaría «pulsada»
    this.keys.clear();
    this.releaseInput();
    this.stopLoop();
    this.draw();
  }

  resume() {
    if (this.destroyed || !this.paused) return;
    this.paused = false;
    // Las explosiones continúan donde se detuvieron
    if (this.pausedAt !== null) {
      const pausedFor = performance.now() - this.pausedAt;
      for (const e of this.explosions) e.start += pausedFor;
    }
    this.pausedAt = null;
    if (this.state !== "gameover") this.startLoop();
  }

  restart() {
    if (this.destroyed) return;
    this.paused = false;
    this.pausedAt = null;
    this.keys.clear();
    this.releaseInput();
    this.stopLoop();
    this.resetGame();
    this.startLoop();
  }

  end() {
    if (this.destroyed || this.state === "gameover") return;
    this.releaseInput();
    this.stopLoop();
    this.finish();
    this.draw();
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.stopLoop();
    this.removeListeners();
    this.keys.clear();
    this.releaseInput();
    this.stopSounds();
  }

  // ── Loop ────────────────────────────────────────────────────────────────────

  private startLoop() {
    if (this.rafId !== null || this.destroyed || this.state === "gameover") {
      return;
    }
    this.lastTime = null; // evita un salto de dt tras pausar
    this.rafId = requestAnimationFrame(this.loop);
  }

  private stopLoop() {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
  }

  private loop = (now: number) => {
    const dt =
      this.lastTime === null
        ? 0
        : Math.min((now - this.lastTime) / 1000, MAX_DT);
    this.lastTime = now;
    this.update(dt);
    this.draw();
    // El fin de partida puede llegar dentro de este mismo frame: no se reprograma.
    this.rafId =
      this.state === "gameover" ? null : requestAnimationFrame(this.loop);
  };

  // ── Teclado ─────────────────────────────────────────────────────────────────

  private addListeners() {
    if (this.listening) return;
    this.listening = true;
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
  }

  private removeListeners() {
    if (!this.listening) return;
    this.listening = false;
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
  }

  private onKeyDown = (e: KeyboardEvent) => {
    // Al escribir iniciales o usar un selector, las teclas no llegan al juego.
    const t = e.target;
    if (
      t instanceof HTMLInputElement ||
      t instanceof HTMLTextAreaElement ||
      t instanceof HTMLSelectElement
    )
      return;
    // Space sobre un botón enfocado lo activa; no debe además lanzar la bola.
    if (e.code === "Space" && t instanceof HTMLButtonElement) return;

    if (!GAME_KEYS.has(e.code)) return;
    if (PREVENT_KEYS.has(e.code)) e.preventDefault();
    if (this.paused || this.state === "gameover") return;

    this.keys.add(e.code);
    // El lanzamiento es una acción puntual: mantener la tecla no la encadena
    if (e.code === "Space" && !e.repeat && this.state === "ready") {
      this.launchBall();
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };

  // Entrada del gamepad virtual (SPEC 10): left/right mantienen la paleta en movimiento
  // y `a` lanza la bola, igual que ESPACIO (una vez por pulsación).
  setInput(button: VirtualButton, pressed: boolean) {
    if (button === "left" || button === "right") {
      // Soltar siempre se procesa; pulsar se ignora en pausa o fin de partida.
      if (!pressed) this.padHeld.delete(button);
      else if (!this.destroyed && !this.paused && this.state !== "gameover")
        this.padHeld.add(button);
    } else if (
      button === "a" &&
      pressed &&
      !this.destroyed &&
      !this.paused &&
      this.state === "ready"
    ) {
      this.launchBall();
    }
  }

  releaseInput() {
    this.padHeld.clear();
  }

  // Velocidad (px/s, magnitud constante) del nivel activo.
  private levelSpeed() {
    return LEVELS[this.level - 1].speed;
  }

  private createBlocks(): Block[] {
    const blocks: Block[] = [];
    const rows = LEVELS[this.level - 1].rows;
    for (let row = 0; row < rows.length; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        const char = rows[row][col];
        if (char === ".") continue;
        const color = LEVEL_CHARS[char];
        if (!color) {
          console.warn(
            `Carácter de nivel desconocido "${char}" en el nivel ${this.level}, fila ${row}`,
          );
          continue;
        }
        const isGray = color === "gray";
        blocks.push({
          x: GRID_X + col * BLOCK_W,
          y: GRID_Y + row * BLOCK_H,
          color,
          hits: isGray ? 2 : 1,
          points: isGray ? 50 : 10,
          alive: true,
        });
      }
    }
    return blocks;
  }

  // Construye los bloques del nivel y deja la bola sobre la paleta en `ready`.
  private loadLevel(level: number) {
    this.level = level;
    this.blocks = this.createBlocks();
    this.explosions = [];
    this.paddle.x = (W - this.paddle.w) / 2;
    this.ball.vx = 0;
    this.ball.vy = 0;
    this.state = "ready";
  }

  private resetGame() {
    this.score = 0;
    this.lives = START_LIVES;
    this.gameOverEmitted = false;
    this.loadLevel(1);
    this.emitStats(true);
  }

  private launchBall() {
    const angle = ((Math.random() * 2 - 1) * LAUNCH_SPREAD * Math.PI) / 180;
    this.ball.vx = this.levelSpeed() * Math.sin(angle);
    this.ball.vy = -this.levelSpeed() * Math.cos(angle);
    this.state = "playing";
  }

  // Lógica por frame; `dt` en segundos, ya limitado a MAX_DT.
  private update(dt: number) {
    const { paddle, ball } = this;

    const now = performance.now();
    this.explosions = this.explosions.filter(
      (e) => now - e.start < EXPLOSION_DURATION,
    );

    let dir = 0;
    if (
      this.keys.has("ArrowLeft") ||
      this.keys.has("KeyA") ||
      this.padHeld.has("left")
    )
      dir -= 1;
    if (
      this.keys.has("ArrowRight") ||
      this.keys.has("KeyD") ||
      this.padHeld.has("right")
    )
      dir += 1;
    paddle.x += dir * PADDLE_SPEED * dt;
    paddle.x = Math.max(0, Math.min(W - paddle.w, paddle.x));

    if (this.state === "ready") {
      ball.x = paddle.x + paddle.w / 2;
      ball.y = paddle.y - ball.r;
    } else if (this.state === "playing") {
      // Sub-pasos: la bola nunca avanza más de MAX_STEP_PX de golpe.
      const steps = Math.max(
        1,
        Math.ceil((Math.hypot(ball.vx, ball.vy) * dt) / MAX_STEP_PX),
      );
      for (let i = 0; i < steps && this.state === "playing"; i++) {
        this.stepBall(dt / steps);
      }
    }
  }

  // Mueve la bola `dt` y resuelve paredes, paleta, suelo y bloques.
  private stepBall(dt: number) {
    const { paddle, ball } = this;

    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    if (ball.x - ball.r < 0) {
      ball.x = ball.r;
      ball.vx = Math.abs(ball.vx);
      this.playSound("bounce");
    } else if (ball.x + ball.r > W) {
      ball.x = W - ball.r;
      ball.vx = -Math.abs(ball.vx);
      this.playSound("bounce");
    }
    if (ball.y - ball.r < 0) {
      ball.y = ball.r;
      ball.vy = Math.abs(ball.vy);
      this.playSound("bounce");
    }

    if (
      ball.vy > 0 &&
      ball.x + ball.r > paddle.x &&
      ball.x - ball.r < paddle.x + paddle.w &&
      ball.y + ball.r > paddle.y &&
      ball.y - ball.r < paddle.y + paddle.h
    ) {
      // -1 en el borde izquierdo, 0 en el centro, 1 en el derecho
      const hit = (ball.x - (paddle.x + paddle.w / 2)) / (paddle.w / 2);
      const angle =
        (Math.max(-1, Math.min(1, hit)) * MAX_BOUNCE_ANGLE * Math.PI) / 180;
      ball.vx = this.levelSpeed() * Math.sin(angle);
      ball.vy = -this.levelSpeed() * Math.cos(angle);
      ball.y = paddle.y - ball.r;
      this.playSound("bounce");
    }

    if (ball.y - ball.r > H) {
      this.lives -= 1;
      ball.vx = 0;
      ball.vy = 0;
      if (this.lives > 0) {
        this.state = "ready";
        this.emitStats();
      } else {
        this.finish();
      }
      return;
    }

    for (const b of this.blocks) {
      if (!b.alive) continue;
      const overlapLeft = ball.x + ball.r - b.x;
      const overlapRight = b.x + BLOCK_W - (ball.x - ball.r);
      const overlapTop = ball.y + ball.r - b.y;
      const overlapBottom = b.y + BLOCK_H - (ball.y - ball.r);
      if (
        overlapLeft <= 0 ||
        overlapRight <= 0 ||
        overlapTop <= 0 ||
        overlapBottom <= 0
      )
        continue;

      // Se resuelve por el eje de menor penetración
      const minX = Math.min(overlapLeft, overlapRight);
      const minY = Math.min(overlapTop, overlapBottom);
      if (minX < minY) {
        if (overlapLeft < overlapRight) {
          ball.x -= overlapLeft;
          ball.vx = -Math.abs(ball.vx);
        } else {
          ball.x += overlapRight;
          ball.vx = Math.abs(ball.vx);
        }
      } else if (overlapTop < overlapBottom) {
        ball.y -= overlapTop;
        ball.vy = -Math.abs(ball.vy);
      } else {
        ball.y += overlapBottom;
        ball.vy = Math.abs(ball.vy);
      }

      b.hits -= 1;
      if (b.hits <= 0) {
        b.alive = false;
        this.score += b.points;
        this.playSound("break");
        this.explosions.push({
          x: b.x,
          y: b.y,
          color: b.color,
          start: performance.now(),
        });
        if (!this.blocks.some((other) => other.alive)) {
          if (this.level < LEVELS.length) {
            this.loadLevel(this.level + 1);
          } else {
            this.finish(); // victoria: también termina la partida
            return;
          }
        }
        this.emitStats();
      } else {
        this.playSound("bounce");
      }
      break; // un bloque por sub-paso
    }
  }

  // El canvas no pinta puntuación, nivel, vidas ni overlays: eso es de React.
  private draw() {
    const r = this.renderer;
    r.clear(W, H);

    for (const b of this.blocks) {
      if (b.alive) r.block(b.color, { x: b.x, y: b.y, w: BLOCK_W, h: BLOCK_H });
    }

    // Pausado, la animación se congela en la hora en que se pausó.
    const now = this.pausedAt ?? performance.now();
    for (const e of this.explosions) {
      const p = Math.min(
        0.999,
        Math.max(0, (now - e.start) / EXPLOSION_DURATION),
      );
      r.explosion(e.color, { x: e.x, y: e.y, w: BLOCK_W, h: BLOCK_H }, p);
    }

    const { paddle, ball } = this;
    r.paddle(paddle);
    r.ball(ball.x, ball.y, ball.r);

    // React no conoce el estado `ready`: la pista de lanzamiento va en el canvas.
    if (this.state === "ready") {
      r.text("ESPACIO PARA LANZAR", W / 2, paddle.y - 70);
    }
  }

  // Solo emite si cambió algún valor (o si se fuerza, al iniciar o reiniciar).
  private emitStats(force = false) {
    const stats: GameStats = {
      score: this.score,
      level: this.level,
      lives: this.lives,
    };
    const last = this.lastStats;
    if (
      !force &&
      last &&
      last.score === stats.score &&
      last.level === stats.level &&
      last.lives === stats.lives
    ) {
      return;
    }
    this.lastStats = stats;
    this.callbacks.onStats(stats);
  }

  // Fin de partida (sin vidas o victoria): onGameOver se emite una sola vez.
  private finish() {
    this.state = "gameover";
    this.emitStats();
    if (this.gameOverEmitted) return;
    this.gameOverEmitted = true;
    this.callbacks.onGameOver(this.score);
  }

  private playSound(kind: "bounce" | "break") {
    if (this.muted || this.destroyed) return;
    const sound = kind === "bounce" ? this.bounceSound : this.breakSound;
    sound.currentTime = 0;
    // El navegador puede rechazar la reproducción (autoplay): se ignora.
    sound.play().catch(() => {});
  }

  private stopSounds() {
    this.bounceSound.pause();
    this.breakSound.pause();
  }
}
