// Motor de Arkanoid portado de references/started-games/04-arkanoid/game.js.
// Recibe un <canvas> y avisa a React por callbacks; no conoce React ni el DOM global.

import type { GameCallbacks, GameStats } from "../engine";
import { LEVELS, LEVEL_CHARS, type BlockColor } from "./levels";
import {
  BALL_SPRITE,
  BLOCK_SPRITES,
  EXPLOSION_DURATION,
  EXPLOSION_FRAMES,
  PADDLE_SPRITE,
  drawFrame,
} from "./sprites";

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
const BG_COLOR = "#000";

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

export class ArkanoidEngine {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly callbacks: GameCallbacks;

  private img: HTMLImageElement | null = null;
  private keys = new Set<string>();

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

  constructor(canvas: HTMLCanvasElement, callbacks: GameCallbacks) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D no disponible");
    this.canvas = canvas;
    this.ctx = ctx;
    this.callbacks = callbacks;
    this.canvas.width = W;
    this.canvas.height = H;
    this.blocks = this.createBlocks();
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
    if (this.keys.has("ArrowLeft") || this.keys.has("KeyA")) dir -= 1;
    if (this.keys.has("ArrowRight") || this.keys.has("KeyD")) dir += 1;
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
    const { ctx, img } = this;
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, W, H);
    if (!img) return;

    for (const b of this.blocks) {
      if (b.alive) {
        drawFrame(ctx, img, BLOCK_SPRITES[b.color], b.x, b.y, BLOCK_W, BLOCK_H);
      }
    }

    // Pausado, la animación se congela en la hora en que se pausó.
    const now = this.pausedAt ?? performance.now();
    for (const e of this.explosions) {
      const frames = EXPLOSION_FRAMES[e.color];
      const i = Math.min(
        frames.length - 1,
        Math.max(
          0,
          Math.floor(((now - e.start) / EXPLOSION_DURATION) * frames.length),
        ),
      );
      drawFrame(ctx, img, frames[i], e.x, e.y, BLOCK_W, BLOCK_H);
    }

    const { paddle, ball } = this;
    drawFrame(ctx, img, PADDLE_SPRITE, paddle.x, paddle.y, paddle.w, paddle.h);
    drawFrame(
      ctx,
      img,
      BALL_SPRITE,
      ball.x - ball.r,
      ball.y - ball.r,
      ball.r * 2,
      ball.r * 2,
    );

    // React no conoce el estado `ready`: la pista de lanzamiento va en el canvas.
    if (this.state === "ready") {
      ctx.fillStyle = "#fff";
      ctx.font = "20px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("ESPACIO PARA LANZAR", W / 2, paddle.y - 70);
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

  // El sonido se conecta en el paso 5.
  private playSound(kind: "bounce" | "break") {
    void kind;
  }
}
