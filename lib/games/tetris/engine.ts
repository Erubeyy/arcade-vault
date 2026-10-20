// Motor de Tetris portado de references/started-games/03-tetris/game.js.
// Recibe un <canvas> y avisa a React por callbacks; no conoce React ni el DOM global.

import type { GameCallbacks, GameStats } from "../engine";
import {
  BLOCK,
  COLS,
  KICKS,
  LINE_SCORES,
  ROWS,
  createBoard,
  intervalForLevel,
  randomPiece,
  rotateCW,
  type Piece,
  type Shape,
} from "./pieces";
import {
  SKINS,
  SKIN_NAMES,
  THEMES,
  THEME_NAMES,
  type TetrisSkin,
  type TetrisTheme,
} from "./skins";

export type { TetrisSkin, TetrisTheme };

export interface TetrisOptions {
  skin: TetrisSkin;
  theme: TetrisTheme;
  startLevel: number; // 1–10
}

const BOARD_W = COLS * BLOCK; // 300
const PANEL_W = 120;
export const W = BOARD_W + PANEL_W; // 420
export const H = ROWS * BLOCK; // 600

const DEFAULTS: TetrisOptions = { skin: "retro", theme: "dark", startLevel: 1 };

function clampLevel(value: unknown): number {
  const n = typeof value === "number" ? Math.floor(value) : NaN;
  return Number.isFinite(n)
    ? Math.min(10, Math.max(1, n))
    : DEFAULTS.startLevel;
}

export class TetrisEngine {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly callbacks: GameCallbacks;

  private skin: TetrisSkin;
  private theme: TetrisTheme;
  private startLevel: number;

  private board: number[][] = createBoard();
  private current!: Piece;
  private next!: Piece;

  private score = 0;
  private lines = 0;
  private level = 1;
  private dropAccum = 0;
  private dropInterval = intervalForLevel(1);
  private gameOver = false;
  private gameOverEmitted = false;

  private destroyed = false;
  private lastStats: GameStats | null = null;

  constructor(
    canvas: HTMLCanvasElement,
    callbacks: GameCallbacks,
    options?: Partial<TetrisOptions>,
  ) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D no disponible");
    this.ctx = ctx;
    this.callbacks = callbacks;
    // Las opciones llegan sin tipar desde el registro: se validan una a una.
    this.skin = SKIN_NAMES.includes(options?.skin as TetrisSkin)
      ? (options!.skin as TetrisSkin)
      : DEFAULTS.skin;
    this.theme = THEME_NAMES.includes(options?.theme as TetrisTheme)
      ? (options!.theme as TetrisTheme)
      : DEFAULTS.theme;
    this.startLevel = clampLevel(options?.startLevel);
    this.initGame();
  }

  destroy() {
    this.destroyed = true;
  }

  // ── Estado del juego ────────────────────────────────────────────────────────

  private initGame() {
    this.board = createBoard();
    this.score = 0;
    this.lines = 0;
    this.level = this.startLevel;
    this.dropInterval = intervalForLevel(this.level);
    this.dropAccum = 0;
    this.gameOver = false;
    this.gameOverEmitted = false;
    this.next = randomPiece();
    this.spawn();
    this.settle(true);
  }

  private collide(shape: Shape, ox: number, oy: number): boolean {
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (!shape[r][c]) continue;
        const nx = ox + c;
        const ny = oy + r;
        if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
        if (ny >= 0 && this.board[ny][nx]) return true;
      }
    }
    return false;
  }

  private spawn() {
    this.current = this.next;
    this.next = randomPiece();
    if (this.collide(this.current.shape, this.current.x, this.current.y)) {
      this.gameOver = true;
    }
  }

  private merge() {
    const { shape, x, y } = this.current;
    for (let r = 0; r < shape.length; r++)
      for (let c = 0; c < shape[r].length; c++)
        if (shape[r][c]) this.board[y + r][x + c] = shape[r][c];
  }

  private clearLines() {
    let cleared = 0;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (this.board[r].every((v) => v !== 0)) {
        this.board.splice(r, 1);
        this.board.unshift(new Array<number>(COLS).fill(0));
        cleared++;
        r++;
      }
    }
    if (cleared) {
      this.lines += cleared;
      // Los puntos usan el nivel vigente antes de subir de nivel.
      this.score += (LINE_SCORES[cleared] || 0) * this.level;
      this.level = this.startLevel + Math.floor(this.lines / 10);
      this.dropInterval = intervalForLevel(this.level);
    }
  }

  private lockPiece() {
    this.merge();
    this.clearLines();
    this.spawn();
  }

  private ghostY(): number {
    let gy = this.current.y;
    while (!this.collide(this.current.shape, this.current.x, gy + 1)) gy++;
    return gy;
  }

  // ── Acciones (las invoca la entrada de teclado y el loop) ───────────────────

  private moveHorizontal(dx: -1 | 1) {
    if (this.gameOver) return;
    const { shape, x, y } = this.current;
    if (!this.collide(shape, x + dx, y)) this.current.x += dx;
  }

  private rotate() {
    if (this.gameOver) return;
    const rotated = rotateCW(this.current.shape);
    for (const kick of KICKS) {
      if (!this.collide(rotated, this.current.x + kick, this.current.y)) {
        this.current.shape = rotated;
        this.current.x += kick;
        return;
      }
    }
  }

  private softDrop() {
    if (this.gameOver) return;
    const { shape, x, y } = this.current;
    if (!this.collide(shape, x, y + 1)) {
      this.current.y++;
      this.score += 1;
    } else {
      this.lockPiece();
    }
    this.settle();
  }

  private hardDrop() {
    if (this.gameOver) return;
    const gy = this.ghostY();
    this.score += (gy - this.current.y) * 2;
    this.current.y = gy;
    this.lockPiece();
    this.settle();
  }

  // Avanza el acumulador de caída; dtMs es el tiempo transcurrido entre frames.
  private tick(dtMs: number) {
    if (this.gameOver) return;
    this.dropAccum += dtMs;
    if (this.dropAccum >= this.dropInterval) {
      this.dropAccum = 0;
      const { shape, x, y } = this.current;
      if (!this.collide(shape, x, y + 1)) this.current.y++;
      else this.lockPiece();
      this.settle();
    }
  }

  // ── Callbacks hacia React ───────────────────────────────────────────────────

  // Emite las estadísticas si cambiaron y, tras ellas, el fin de partida.
  private settle(force = false) {
    this.emitStats(force);
    if (this.gameOver) this.emitGameOver();
  }

  private emitStats(force = false) {
    const { score, level } = this;
    const last = this.lastStats;
    if (!force && last && last.score === score && last.level === level) return;
    this.lastStats = { score, level };
    this.callbacks.onStats({ score, level });
  }

  private emitGameOver() {
    if (this.gameOverEmitted) return;
    this.gameOverEmitted = true;
    this.callbacks.onGameOver(this.score);
  }

  // ── Dibujo ──────────────────────────────────────────────────────────────────

  private drawBlock(
    ctx: CanvasRenderingContext2D,
    gx: number,
    gy: number,
    colorIndex: number,
    ox = 0,
    oy = 0,
    alpha = 1,
  ) {
    if (!colorIndex) return;
    const skin = SKINS[this.skin];
    const color = skin.colors[colorIndex];
    if (!color) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    skin.draw(ctx, ox + gx * BLOCK, oy + gy * BLOCK, BLOCK, color);
    ctx.restore();
  }

  private drawPiece(piece: Piece, gy: number, alpha = 1) {
    const { shape, x } = piece;
    for (let r = 0; r < shape.length; r++)
      for (let c = 0; c < shape[r].length; c++)
        this.drawBlock(this.ctx, x + c, gy + r, shape[r][c], 0, 0, alpha);
  }

  private draw() {
    const { ctx } = this;
    const tokens = THEMES[this.skin][this.theme];

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = tokens.background;
    ctx.fillRect(0, 0, W, H);

    // rejilla
    ctx.strokeStyle = tokens.grid;
    ctx.lineWidth = 0.5;
    for (let c = 1; c < COLS; c++) {
      ctx.beginPath();
      ctx.moveTo(c * BLOCK, 0);
      ctx.lineTo(c * BLOCK, H);
      ctx.stroke();
    }
    for (let r = 1; r < ROWS; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * BLOCK);
      ctx.lineTo(BOARD_W, r * BLOCK);
      ctx.stroke();
    }

    // tablero, fantasma y pieza actual
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        this.drawBlock(ctx, c, r, this.board[r][c]);
    this.drawPiece(this.current, this.ghostY(), tokens.ghostAlpha);
    this.drawPiece(this.current, this.current.y);

    this.drawPanel(tokens.grid, tokens.label);
  }

  // Panel derecho: separador, rótulo «SIGUIENTE» y la siguiente pieza.
  private drawPanel(lineColor: string, labelColor: string) {
    const { ctx } = this;
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(BOARD_W + 0.5, 0);
    ctx.lineTo(BOARD_W + 0.5, H);
    ctx.stroke();

    ctx.fillStyle = labelColor;
    ctx.font = "bold 12px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillText("SIGUIENTE", BOARD_W + PANEL_W / 2, 28);

    // Caja de 4×4 celdas centrada en el panel; la pieza se centra dentro de ella.
    const { shape } = this.next;
    const boxX = BOARD_W + (PANEL_W - 4 * BLOCK) / 2;
    const boxY = 44;
    const offX = Math.floor((4 - shape[0].length) / 2);
    const offY = Math.floor((4 - shape.length) / 2);
    for (let r = 0; r < shape.length; r++)
      for (let c = 0; c < shape[r].length; c++)
        this.drawBlock(ctx, offX + c, offY + r, shape[r][c], boxX, boxY);
  }
}
