// Motor de Snake (SPEC 09). No tiene juego de referencia: las constantes se definen en el spec.
// Recibe un <canvas> y avisa a React por callbacks; no conoce React ni el DOM global.

import type {
  GameCallbacks,
  GameEngine,
  GameStats,
  VirtualButton,
} from "../engine";

import {
  FRUIT_NAMES,
  FRUIT_TINT,
  PIXEL_FRUIT,
  drawFruit,
  loadFruits,
  type FruitName,
} from "./sprites";
import {
  SKIN_NAMES,
  THEMES,
  THEME_NAMES,
  type SnakeSkin,
  type SnakeTheme,
  type ThemeTokens,
} from "./skins";

export type { SnakeSkin, SnakeTheme };

// Opciones de apariencia: solo cambian el dibujo, nunca la partida.
export interface SnakeOptions {
  skin: SnakeSkin;
  theme: SnakeTheme;
}

const DEFAULTS: SnakeOptions = { skin: "classic", theme: "dark" };

export const W = 800;
export const H = 600;

const CELL = 40;
const COLS = W / CELL; // 20
const ROWS = H / CELL; // 15
const START_LENGTH = 3;
const START_STEP_MS = 140;
const STEP_DECREASE_MS = 3; // por fruta comida
const MIN_STEP_MS = 60;
const POINTS_PER_FRUIT = 10;
const FRUITS_PER_LEVEL = 5;
const MAX_QUEUE = 2; // giros pendientes por paso
const MAX_FRAME_MS = 100; // evita una ráfaga de pasos tras un lag

const FRUIT_SIZE = 36; // lado mayor del sprite dentro de la celda de 40 px
const OUTLINE_OFFSETS = [
  [-2, 0],
  [2, 0],
  [0, -2],
  [0, 2],
  [-1.5, -1.5],
  [1.5, -1.5],
  [-1.5, 1.5],
  [1.5, 1.5],
] as const;

interface Cell {
  x: number;
  y: number;
}

type State = "playing" | "gameover";

interface Fruit extends Cell {
  name: FruitName;
}

const UP: Cell = { x: 0, y: -1 };
const DOWN: Cell = { x: 0, y: 1 };
const LEFT: Cell = { x: -1, y: 0 };
const RIGHT: Cell = { x: 1, y: 0 };

// Teclas del juego. Todas giran la serpiente; las flechas además llevan
// preventDefault (evitan el scroll de la página), WASD no desplaza nada.
const ARROW_KEYS: Record<string, Cell> = {
  ArrowUp: UP,
  ArrowDown: DOWN,
  ArrowLeft: LEFT,
  ArrowRight: RIGHT,
};
const PAD_DIRS: Partial<Record<VirtualButton, Cell>> = {
  up: UP,
  down: DOWN,
  left: LEFT,
  right: RIGHT,
};
const TURN_KEYS: Record<string, Cell> = {
  ...ARROW_KEYS,
  KeyW: UP,
  KeyS: DOWN,
  KeyA: LEFT,
  KeyD: RIGHT,
};

export class SnakeEngine implements GameEngine {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly callbacks: GameCallbacks;

  private img: HTMLImageElement | null = null;
  private skin: SnakeSkin;
  private theme: SnakeTheme;
  private t: ThemeTokens;

  private state: State = "playing";
  private snake: Cell[] = []; // índice 0 = cabeza
  private dir: Cell = RIGHT;
  private queue: Cell[] = [];
  private fruit: Fruit = { x: 0, y: 0, name: FRUIT_NAMES[0] };
  private eaten = 0;
  private score = 0;
  private level = 1;
  private stepMs = START_STEP_MS;
  private accum = 0; // ms acumulados desde el último paso

  private lastStats: GameStats | null = null;
  private gameOverEmitted = false;

  private started = false;
  private loaded = false; // terminó la carga del atlas (con o sin error)
  private paused = false;
  private destroyed = false;
  private listening = false;
  private rafId: number | null = null;
  private lastTime: number | null = null;

  constructor(
    canvas: HTMLCanvasElement,
    callbacks: GameCallbacks,
    options?: Partial<SnakeOptions>,
  ) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D no disponible");
    this.canvas = canvas;
    this.ctx = ctx;
    this.callbacks = callbacks;
    this.canvas.width = W;
    this.canvas.height = H;
    // Valores inválidos (p. ej. preferencias corruptas) caen a los de serie.
    this.skin = SKIN_NAMES.includes(options?.skin as SnakeSkin)
      ? (options!.skin as SnakeSkin)
      : DEFAULTS.skin;
    this.theme = THEME_NAMES.includes(options?.theme as SnakeTheme)
      ? (options!.theme as SnakeTheme)
      : DEFAULTS.theme;
    this.t = THEMES[this.skin][this.theme];
    this.initState();
  }

  // ── Apariencia (solo dibujo; no afecta a la partida) ───────────────────────

  setSkin(skin: SnakeSkin) {
    if (!SKIN_NAMES.includes(skin)) return;
    this.skin = skin;
    this.applyLook();
  }

  setTheme(theme: SnakeTheme) {
    if (!THEME_NAMES.includes(theme)) return;
    this.theme = theme;
    this.applyLook();
  }

  private applyLook() {
    this.t = THEMES[this.skin][this.theme];
    // Repinta ya, por si el bucle está detenido (pausa o fin de partida).
    if (!this.destroyed) this.draw();
  }

  // ── Ciclo de vida ───────────────────────────────────────────────────────────

  start() {
    if (this.destroyed || this.started) return;
    this.started = true;
    this.resetGame();
    this.addListeners();
    loadFruits()
      .then((img) => {
        this.img = img;
      })
      // Sin atlas la fruta se dibuja como círculo y la partida sigue.
      .catch((err) => console.error(err))
      .then(() => {
        // destroy() pudo llegar mientras cargaba la imagen
        if (this.destroyed) return;
        this.loaded = true;
        if (this.paused || this.state === "gameover") this.draw();
        else this.startLoop();
      });
  }

  pause() {
    if (this.destroyed || this.paused) return;
    this.paused = true;
    // Un giro pendiente durante la pausa se aplicaría de golpe al reanudar
    this.queue = [];
    this.stopLoop();
    this.draw();
  }

  resume() {
    if (this.destroyed || !this.paused) return;
    this.paused = false;
    this.accum = 0;
    if (this.loaded && this.state !== "gameover") this.startLoop();
  }

  restart() {
    if (this.destroyed) return;
    this.paused = false;
    this.stopLoop();
    this.resetGame();
    if (this.loaded) this.startLoop();
    else this.draw();
  }

  end() {
    if (this.destroyed || this.state === "gameover") return;
    this.stopLoop();
    this.finish();
    this.draw();
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.stopLoop();
    this.removeListeners();
    this.queue = [];
  }

  // Entrada del gamepad virtual (SPEC 10): cada pulsación encola un giro, igual que una flecha.
  setInput(button: VirtualButton, pressed: boolean) {
    if (!pressed || this.destroyed || this.paused || this.state === "gameover")
      return;
    const dir = PAD_DIRS[button];
    if (dir) this.queueTurn(dir);
  }

  // Los giros son puntuales y no hay botones «mantenidos» que soltar.
  releaseInput() {}

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
    const dtMs = this.lastTime === null ? 0 : now - this.lastTime;
    this.lastTime = now;
    this.update(dtMs);
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
  }

  private removeListeners() {
    if (!this.listening) return;
    this.listening = false;
    window.removeEventListener("keydown", this.onKeyDown);
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

    const dir = TURN_KEYS[e.code];
    if (!dir) return;
    if (e.code in ARROW_KEYS) e.preventDefault();
    if (this.paused || this.state === "gameover") return;
    this.queueTurn(dir);
  };

  // ── Estado ──────────────────────────────────────────────────────────────────

  // Reinicia la partida y avisa a React.
  private resetGame() {
    this.initState();
    this.emitStats(true);
  }

  // Serpiente de 3 segmentos en el centro, mirando a la derecha.
  private initState() {
    const cy = Math.floor(ROWS / 2);
    const cx = Math.floor(COLS / 2);
    this.snake = Array.from({ length: START_LENGTH }, (_, i) => ({
      x: cx - i,
      y: cy,
    }));
    this.dir = RIGHT;
    this.queue = [];
    this.eaten = 0;
    this.score = 0;
    this.level = 1;
    this.stepMs = START_STEP_MS;
    this.accum = 0;
    this.state = "playing";
    this.gameOverEmitted = false;
    this.spawnFruit();
  }

  // Encola un giro. Se descarta si repite o invierte (180°) la última dirección.
  private queueTurn(dir: Cell) {
    if (this.queue.length >= MAX_QUEUE) return;
    const last = this.queue[this.queue.length - 1] ?? this.dir;
    if (dir.x === last.x && dir.y === last.y) return;
    if (dir.x === -last.x && dir.y === -last.y) return;
    this.queue.push(dir);
  }

  // Elige una celda libre al azar; devuelve false si el tablero está lleno.
  private spawnFruit(): boolean {
    const taken = new Set(this.snake.map((c) => c.y * COLS + c.x));
    const free: Cell[] = [];
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (!taken.has(y * COLS + x)) free.push({ x, y });
      }
    }
    if (free.length === 0) return false;
    const cell = free[Math.floor(Math.random() * free.length)];
    const name = FRUIT_NAMES[Math.floor(Math.random() * FRUIT_NAMES.length)];
    this.fruit = { ...cell, name };
    return true;
  }

  // Suma `dtMs` y da un paso por cada `stepMs` acumulado.
  private update(dtMs: number) {
    this.accum += Math.min(dtMs, MAX_FRAME_MS);
    while (this.accum >= this.stepMs && this.state === "playing") {
      this.accum -= this.stepMs;
      this.step();
    }
  }

  // Avanza la serpiente una celda con borde toroidal.
  private step() {
    const next = this.queue.shift();
    if (next) this.dir = next;

    const head = this.snake[0];
    const x = (head.x + this.dir.x + COLS) % COLS;
    const y = (head.y + this.dir.y + ROWS) % ROWS;
    const eating = x === this.fruit.x && y === this.fruit.y;

    // Si no come, la cola se retira en este paso y su celda queda libre.
    const body = eating ? this.snake : this.snake.slice(0, -1);
    if (body.some((c) => c.x === x && c.y === y)) {
      this.finish();
      return;
    }

    this.snake.unshift({ x, y });
    if (!eating) {
      this.snake.pop();
      return;
    }

    this.eaten += 1;
    this.score += POINTS_PER_FRUIT;
    this.level = 1 + Math.floor(this.eaten / FRUITS_PER_LEVEL);
    this.stepMs = Math.max(
      MIN_STEP_MS,
      START_STEP_MS - STEP_DECREASE_MS * this.eaten,
    );
    if (!this.spawnFruit()) {
      this.finish(); // tablero lleno: victoria
      return;
    }
    this.emitStats();
  }

  // ── Dibujo ──────────────────────────────────────────────────────────────────

  // El canvas no pinta puntuación, nivel ni overlays: eso es de React.
  private draw() {
    const { ctx, t } = this;
    ctx.save();
    // Retro: sin suavizado (bordes duros); el resto escala el atlas suavizado.
    ctx.imageSmoothingEnabled = t.pixel === 0;
    ctx.shadowBlur = 0;
    ctx.fillStyle = t.background;
    ctx.fillRect(0, 0, W, H);
    this.drawGrid();
    this.drawFruitCell();
    this.drawSnake();
    ctx.restore();
  }

  private drawGrid() {
    const { ctx, t } = this;
    if (!t.grid) return;
    ctx.strokeStyle = t.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 1; x < COLS; x++) {
      ctx.moveTo(x * CELL + 0.5, 0);
      ctx.lineTo(x * CELL + 0.5, H);
    }
    for (let y = 1; y < ROWS; y++) {
      ctx.moveTo(0, y * CELL + 0.5);
      ctx.lineTo(W, y * CELL + 0.5);
    }
    ctx.stroke();
  }

  // Activa el glow del neón con el color dado (no-op si el skin no tiene glow).
  private setGlow(color: string) {
    const { ctx, t } = this;
    ctx.shadowBlur = t.glow;
    ctx.shadowColor = t.glow > 0 ? color : "transparent";
  }

  private drawFruitCell() {
    const { ctx, img, fruit, t } = this;
    if (t.pixel > 0 && t.fruitTints) {
      this.drawPixelFruit();
      return;
    }
    const cx = fruit.x * CELL + CELL / 2;
    const cy = fruit.y * CELL + CELL / 2;
    if (img && t.fruitOutline) {
      // Contorno plano (sombra sin desenfoque en 8 direcciones): las frutas
      // blancas, como el nabo, desaparecerían sobre un fondo claro.
      ctx.shadowColor = t.fruitOutline;
      ctx.shadowBlur = 0;
      for (const [dx, dy] of OUTLINE_OFFSETS) {
        ctx.shadowOffsetX = dx;
        ctx.shadowOffsetY = dy;
        drawFruit(ctx, img, fruit.name, cx, cy, FRUIT_SIZE);
      }
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
      ctx.shadowColor = "transparent";
    }
    this.setGlow(t.fruitGlow);
    if (img) {
      drawFruit(ctx, img, fruit.name, cx, cy, FRUIT_SIZE);
    } else {
      // Sin imagen (error de carga) la fruta es un círculo de color.
      ctx.fillStyle = t.fruitFallback;
      ctx.beginPath();
      ctx.arc(cx, cy, FRUIT_SIZE / 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
  }

  // Retro: bitmap de 8×8 «píxeles» de `t.pixel` px, con contorno opcional.
  private drawPixelFruit() {
    const { ctx, fruit, t } = this;
    const p = t.pixel;
    const tints = t.fruitTints!;
    const ox = fruit.x * CELL + (CELL - p * 8) / 2;
    const oy = fruit.y * CELL + (CELL - p * 8) / 2;
    const color: Record<string, string> = {
      L: t.fruitLeaf,
      F: tints[FRUIT_TINT[fruit.name]],
      H: t.fruitShine,
    };
    if (t.fruitOutline) {
      // Contorno de 1 píxel: cada píxel lleno pinta antes un bloque de 3×3.
      ctx.fillStyle = t.fruitOutline;
      PIXEL_FRUIT.forEach((row, y) => {
        for (let x = 0; x < row.length; x++) {
          if (row[x] === ".") continue;
          ctx.fillRect(ox + (x - 1) * p, oy + (y - 1) * p, p * 3, p * 3);
        }
      });
    }
    PIXEL_FRUIT.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const c = color[row[x]];
        if (!c) continue;
        ctx.fillStyle = c;
        ctx.fillRect(ox + x * p, oy + y * p, p, p);
      }
    });
  }

  // Rectángulo de segmento: redondeado en vectorial, de bordes duros en retro.
  private segment(x: number, y: number, size: number, radius: number) {
    const { ctx } = this;
    ctx.beginPath();
    if (radius > 0) ctx.roundRect(x, y, size, size, radius);
    else ctx.rect(x, y, size, size);
    ctx.fill();
  }

  // Cuerpo de la cola a la cabeza y cabeza con ojos.
  private drawSnake() {
    const { ctx, snake, t } = this;
    const retro = t.pixel > 0;
    // En retro todo cae en múltiplos del píxel (4 px) para bordes nítidos.
    const pad = retro ? t.pixel : 3;
    const size = CELL - pad * 2;
    for (let i = snake.length - 1; i >= 1; i--) {
      const k = snake.length > 2 ? (i - 1) / (snake.length - 2) : 0;
      const color = k > 0.66 ? t.tail : t.body;
      const x = snake[i].x * CELL;
      const y = snake[i].y * CELL;
      ctx.fillStyle = color;
      this.setGlow(color);
      this.segment(x + pad, y + pad, size, t.radius);
      if (t.scale) {
        // «Escama» central de 4×4 píxeles retro.
        const s = t.pixel * 4;
        ctx.fillStyle = t.scale;
        ctx.fillRect(x + (CELL - s) / 2, y + (CELL - s) / 2, s, s);
      }
    }

    const head = snake[0];
    const hp = retro ? t.pixel : 1;
    ctx.fillStyle = t.head;
    this.setGlow(t.head);
    this.segment(
      head.x * CELL + hp,
      head.y * CELL + hp,
      CELL - hp * 2,
      t.radius > 0 ? t.radius + 4 : 0,
    );
    ctx.shadowBlur = 0;

    // Ojos desplazados hacia delante y separados en perpendicular a la dirección.
    const cx = head.x * CELL + CELL / 2 + this.dir.x * (retro ? 8 : 7);
    const cy = head.y * CELL + CELL / 2 + this.dir.y * (retro ? 8 : 7);
    ctx.fillStyle = t.eye;
    for (const side of [-1, 1]) {
      const ex = cx - this.dir.y * side * 8;
      const ey = cy + this.dir.x * side * 8;
      if (retro) {
        ctx.fillRect(ex - 4, ey - 4, 8, 8);
        continue;
      }
      ctx.beginPath();
      ctx.arc(ex, ey, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ── Callbacks ───────────────────────────────────────────────────────────────

  // Solo emite si cambió algún valor (o si se fuerza, al iniciar o reiniciar).
  private emitStats(force = false) {
    const stats: GameStats = { score: this.score, level: this.level };
    const last = this.lastStats;
    if (
      !force &&
      last &&
      last.score === stats.score &&
      last.level === stats.level
    ) {
      return;
    }
    this.lastStats = stats;
    this.callbacks.onStats(stats);
  }

  // Fin de partida (choque o tablero lleno): onGameOver se emite una sola vez.
  private finish() {
    this.state = "gameover";
    this.emitStats();
    if (this.gameOverEmitted) return;
    this.gameOverEmitted = true;
    this.callbacks.onGameOver(this.score);
  }
}
