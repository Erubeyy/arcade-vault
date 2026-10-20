// Motor de Snake (SPEC 09). No tiene juego de referencia: las constantes se definen en el spec.
// Recibe un <canvas> y avisa a React por callbacks; no conoce React ni el DOM global.

import type { GameCallbacks, GameEngine, GameStats } from "../engine";

import { FRUIT_NAMES, drawFruit, loadFruits, type FruitName } from "./sprites";

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

const BG_COLOR = "#05080a";
const GRID_COLOR = "rgba(0, 255, 136, 0.06)";
const SNAKE_HEAD = "#00ff88";
const SNAKE_BODY = "#00d673";
const SNAKE_TAIL = "#00894c";
const EYE_COLOR = "#05080a";
const FRUIT_SIZE = 36; // lado mayor del sprite dentro de la celda de 40 px

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

  constructor(canvas: HTMLCanvasElement, callbacks: GameCallbacks) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D no disponible");
    this.canvas = canvas;
    this.ctx = ctx;
    this.callbacks = callbacks;
    this.canvas.width = W;
    this.canvas.height = H;
    this.initState();
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
    const { ctx } = this;
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, W, H);
    this.drawGrid();
    this.drawFruitCell();
    this.drawSnake();
  }

  private drawGrid() {
    const { ctx } = this;
    ctx.strokeStyle = GRID_COLOR;
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

  private drawFruitCell() {
    const { ctx, img, fruit } = this;
    const cx = fruit.x * CELL + CELL / 2;
    const cy = fruit.y * CELL + CELL / 2;
    if (img) {
      drawFruit(ctx, img, fruit.name, cx, cy, FRUIT_SIZE);
      return;
    }
    // Sin imagen (error de carga) la fruta es un círculo de color.
    ctx.fillStyle = "#ff006e";
    ctx.beginPath();
    ctx.arc(cx, cy, FRUIT_SIZE / 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Cuerpo con rectángulos redondeados (de la cola a la cabeza) y cabeza con ojos.
  private drawSnake() {
    const { ctx, snake } = this;
    const pad = 3;
    const size = CELL - pad * 2;
    for (let i = snake.length - 1; i >= 1; i--) {
      const t = snake.length > 2 ? (i - 1) / (snake.length - 2) : 0;
      ctx.fillStyle = t > 0.66 ? SNAKE_TAIL : SNAKE_BODY;
      ctx.beginPath();
      ctx.roundRect(
        snake[i].x * CELL + pad,
        snake[i].y * CELL + pad,
        size,
        size,
        8,
      );
      ctx.fill();
    }

    const head = snake[0];
    ctx.fillStyle = SNAKE_HEAD;
    ctx.beginPath();
    ctx.roundRect(head.x * CELL + 1, head.y * CELL + 1, CELL - 2, CELL - 2, 12);
    ctx.fill();

    // Ojos desplazados hacia delante y separados en perpendicular a la dirección.
    const cx = head.x * CELL + CELL / 2 + this.dir.x * 7;
    const cy = head.y * CELL + CELL / 2 + this.dir.y * 7;
    ctx.fillStyle = EYE_COLOR;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(
        cx - this.dir.y * side * 8,
        cy + this.dir.x * side * 8,
        3.5,
        0,
        Math.PI * 2,
      );
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
