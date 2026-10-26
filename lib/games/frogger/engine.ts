// Motor de Frogger (SPEC 11). No tiene juego de referencia: las constantes se definen en el spec.
// Recibe un <canvas> y avisa a React por callbacks; no conoce React ni el DOM global.

import type {
  GameCallbacks,
  GameEngine,
  GameStats,
  VirtualButton,
} from "../engine";

export const W = 640;
export const H = 560;

const CELL = 40;
const COLS = W / CELL; // 16
const ROWS = H / CELL; // 14

// Filas (0 = arriba)
const ROW_GOALS = 0;
const ROW_RIVER_TOP = 1;
const ROW_RIVER_BOT = 6;
const ROW_SAFE_MID = 7;
const ROW_ROAD_TOP = 8;
const ROW_ROAD_BOT = 12;
const ROW_START = 13;
const START_COL = 8;

const JUMP_MS = 120;
const START_LIVES = 3;
const BASE_TIME_MS = 15000;
const TIME_STEP_MS = 1000; // menos por nivel
const MIN_TIME_MS = 8000;
const TURTLE_UP_MS = 3000;
const TURTLE_DOWN_MS = 1500;
const SPEED_PER_LEVEL = 1.15;
const MAX_SPEED_MULT = 2.5;
const LOOP_LEN = COLS + 4; // longitud del bucle de cada carril, en celdas
const MAX_FRAME_MS = 100; // evita saltos tras un lag

const POINTS_ROW = 10;
const POINTS_GOAL = 50;
const POINTS_ROUND = 200;
const POINTS_TIME = 10; // por segundo restante

const GOALS = [1, 4, 7, 10, 13]; // columna inicial de cada boca (ancho 2)
const GOAL_WIDTH = 2;

type EntityKind = "car" | "truck" | "log" | "turtle";

interface Entity {
  col: number;
  width: number;
  kind: EntityKind;
  phase?: number; // ms dentro del ciclo de inmersión (solo tortugas)
}

interface Lane {
  row: number;
  dir: 1 | -1;
  speed: number; // celdas por segundo, ya escalada por nivel
  entities: Entity[];
}

interface Frog {
  col: number;
  row: number;
  animating: boolean;
  animT: number;
  fromCol: number;
  fromRow: number;
  toCol: number;
  toRow: number;
}

interface LaneSpec {
  row: number;
  kind: EntityKind;
  width: number;
  count: number;
  speed: number; // celdas/s en el nivel 1
  dir: 1 | -1;
}

// Tabla de carriles del nivel 1 (SPEC 11).
const LANE_SPECS: LaneSpec[] = [
  { row: 1, kind: "log", width: 3, count: 3, speed: 3.4, dir: -1 },
  { row: 2, kind: "log", width: 2, count: 3, speed: 2.6, dir: 1 },
  { row: 3, kind: "turtle", width: 3, count: 3, speed: 2.0, dir: -1 },
  { row: 4, kind: "log", width: 4, count: 2, speed: 3.0, dir: 1 },
  { row: 5, kind: "log", width: 3, count: 3, speed: 2.2, dir: 1 },
  { row: 6, kind: "turtle", width: 2, count: 3, speed: 1.8, dir: -1 },
  { row: 8, kind: "truck", width: 3, count: 2, speed: 3.0, dir: -1 },
  { row: 9, kind: "car", width: 2, count: 3, speed: 4.0, dir: -1 },
  { row: 10, kind: "truck", width: 3, count: 2, speed: 2.5, dir: 1 },
  { row: 11, kind: "car", width: 1, count: 3, speed: 3.5, dir: -1 },
  { row: 12, kind: "car", width: 1, count: 3, speed: 2.5, dir: 1 },
];

const TURTLE_CYCLE_MS = TURTLE_UP_MS + TURTLE_DOWN_MS;

const speedMult = (level: number) =>
  Math.min(SPEED_PER_LEVEL ** (level - 1), MAX_SPEED_MULT);

const roundTimeMs = (level: number) =>
  Math.max(MIN_TIME_MS, BASE_TIME_MS - TIME_STEP_MS * (level - 1));

// Reparte `count` entidades a intervalos iguales sobre LOOP_LEN, con un desfase distinto por carril
// y, en las tortugas, una fase de inmersión distinta por grupo.
function buildLanes(level: number): Lane[] {
  const mult = speedMult(level);
  return LANE_SPECS.map((s) => {
    const spacing = LOOP_LEN / s.count;
    const offset = (s.row * 3.1) % spacing;
    const entities: Entity[] = [];
    for (let i = 0; i < s.count; i++) {
      const e: Entity = {
        col: -4 + offset + i * spacing,
        width: s.width,
        kind: s.kind,
      };
      if (s.kind === "turtle") {
        e.phase = (s.row * 900 + i * 1700) % TURTLE_CYCLE_MS;
      }
      entities.push(e);
    }
    return { row: s.row, dir: s.dir, speed: s.speed * mult, entities };
  });
}

type Direction = "up" | "down" | "left" | "right";
type State = "playing" | "gameover";

const FACING: Record<Direction, number> = {
  up: 0,
  right: Math.PI / 2,
  down: Math.PI,
  left: -Math.PI / 2,
};

const COLORS = {
  road: "#15171d",
  roadLine: "#3a3f4d",
  water: "#0a2a4d",
  waterLine: "#14487a",
  grass: "#12391f",
  wall: "#0b2514",
  goal: "#1f7a3d",
  goalBorder: "#f2c14e",
  log: "#7a4a24",
  logLine: "#5a3416",
  shell: "#3fae5a",
  shellLine: "#25793a",
  frog: "#8dff4a",
  frogDark: "#4fb82a",
  eye: "#ffffff",
  pupil: "#0a1f0a",
  cars: ["#e5483f", "#f2c14e", "#3d8bff", "#c46bff", "#ff8a3d"],
  truckBody: "#8b93a3",
  truckCab: "#d8dde6",
  wheel: "#0c0d10",
  timeOk: "#4cd964",
  timeWarn: "#f2c14e",
  timeLow: "#ff453a",
};

const isRiverRow = (row: number) =>
  row >= ROW_RIVER_TOP && row <= ROW_RIVER_BOT;
const isRoadRow = (row: number) => row >= ROW_ROAD_TOP && row <= ROW_ROAD_BOT;
const isSubmerged = (e: Entity) =>
  e.kind === "turtle" && (e.phase ?? 0) >= TURTLE_UP_MS;
const covers = (e: Entity, center: number) =>
  center >= e.col && center < e.col + e.width;

const KEY_DIRS: Record<string, Direction> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  KeyW: "up",
  KeyS: "down",
  KeyA: "left",
  KeyD: "right",
};

// Los botones a/b del gamepad virtual no se usan en Frogger.
const PAD_DIRS: Partial<Record<VirtualButton, Direction>> = {
  up: "up",
  down: "down",
  left: "left",
  right: "right",
};

export class FroggerEngine implements GameEngine {
  private state: State = "playing";
  private frog!: Frog;
  private lanes: Lane[] = [];
  private goals: boolean[] = GOALS.map(() => false); // bocas ocupadas
  private pendingDir: Direction | null = null;
  private furthestRow = ROW_START; // fila más alta alcanzada desde la última boca
  private timeLeft = BASE_TIME_MS;
  private lives = START_LIVES;
  private score = 0;
  private level = 1;
  private facing = 0; // rotación de la rana en radianes (0 = mira arriba)
  private ctx: CanvasRenderingContext2D;

  private started = false;
  private paused = false;
  private destroyed = false;
  private listening = false;
  private rafId: number | null = null;
  private lastTime: number | null = null;

  constructor(
    private canvas: HTMLCanvasElement,
    private cb: GameCallbacks,
  ) {
    this.ctx = canvas.getContext("2d")!;
    this.reset();
  }

  // ── Ciclo de vida ───────────────────────────────────────────────────────────

  start() {
    if (this.destroyed || this.started) return;
    this.started = true;
    this.resetGame();
    this.addListeners();
    this.startLoop();
  }

  pause() {
    if (this.destroyed || this.paused) return;
    this.paused = true;
    // Un salto pendiente durante la pausa se ejecutaría de golpe al reanudar.
    this.pendingDir = null;
    this.stopLoop();
    this.draw();
  }

  resume() {
    if (this.destroyed || !this.paused) return;
    this.paused = false;
    if (this.state !== "gameover") this.startLoop();
  }

  restart() {
    if (this.destroyed) return;
    this.paused = false;
    this.stopLoop();
    this.resetGame();
    this.startLoop();
  }

  end() {
    if (this.destroyed || this.state === "gameover") return;
    this.stopLoop();
    this.state = "gameover";
    this.pendingDir = null;
    this.cb.onGameOver(this.score);
    this.draw();
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.stopLoop();
    this.removeListeners();
    this.pendingDir = null;
  }

  // Entrada del gamepad virtual (SPEC 10): cada pulsación es un salto, igual que una flecha.
  setInput(button: VirtualButton, pressed: boolean) {
    if (!pressed) return;
    const dir = PAD_DIRS[button];
    if (dir) this.queueJump(dir);
  }

  // Los saltos son puntuales y no hay botones «mantenidos» que soltar.
  releaseInput() {
    this.pendingDir = null;
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
      this.lastTime === null ? 0 : Math.min(now - this.lastTime, MAX_FRAME_MS);
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
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    const dir = KEY_DIRS[e.code];
    if (!dir) return;
    e.preventDefault();
    if (e.repeat) return;
    this.queueJump(dir);
  };

  private queueJump(dir: Direction) {
    if (this.destroyed || this.paused || this.state === "gameover") return;
    this.pendingDir = dir; // un solo salto pendiente: la última pulsación gana
  }

  // Reinicia la partida y avisa a React.
  private resetGame() {
    this.reset();
    this.emitStats(true);
  }

  // Estado de una partida nueva. No emite stats: lo hace quien llama.
  private reset() {
    this.state = "playing";
    this.lives = START_LIVES;
    this.score = 0;
    this.level = 1;
    this.goals = GOALS.map(() => false);
    this.lanes = buildLanes(1);
    this.furthestRow = ROW_START;
    this.spawn();
  }

  private spawn() {
    this.frog = {
      col: START_COL,
      row: ROW_START,
      animating: false,
      animT: 0,
      fromCol: START_COL,
      fromRow: ROW_START,
      toCol: START_COL,
      toRow: ROW_START,
    };
    this.pendingDir = null;
    this.timeLeft = roundTimeMs(this.level);
  }

  private laneAt(row: number): Lane | undefined {
    return this.lanes.find((l) => l.row === row);
  }

  private getSupport(): Entity | null {
    const lane = this.laneAt(this.frog.row);
    if (!lane) return null;
    const center = this.frog.col + 0.5;
    const e = lane.entities.find((en) => covers(en, center));
    return e && !isSubmerged(e) ? e : null;
  }

  private checkRoadCollision(): boolean {
    const lane = this.laneAt(this.frog.row);
    if (!lane) return false;
    const center = this.frog.col + 0.5;
    return lane.entities.some((en) => covers(en, center));
  }

  // Avanza las entidades de cada carril y el ciclo de inmersión de las tortugas.
  private moveLanes(dt: number) {
    for (const lane of this.lanes) {
      const dx = (lane.dir * lane.speed * dt) / 1000;
      for (const e of lane.entities) {
        e.col += dx;
        if (lane.dir === 1 && e.col >= COLS) e.col -= LOOP_LEN;
        else if (lane.dir === -1 && e.col + e.width <= 0) e.col += LOOP_LEN;
        if (e.phase !== undefined) e.phase = (e.phase + dt) % TURTLE_CYCLE_MS;
      }
    }
  }

  // Un paso de simulación. Devuelve sin hacer nada si la partida terminó.
  private update(dt: number) {
    if (this.state !== "playing") return;
    const frog = this.frog;

    // Apoyo antes de mover el carril: la rana se queda con lo que tenía bajo los pies.
    const riding = isRiverRow(frog.row) && !frog.animating;
    const support = riding ? this.getSupport() : null;

    this.moveLanes(dt);

    if (riding) {
      if (!support) return this.killFrog(); // agua o tortuga sumergida
      const lane = this.laneAt(frog.row)!;
      frog.col += (lane.dir * lane.speed * dt) / 1000;
      const center = frog.col + 0.5;
      if (center < 0 || center >= COLS) return this.killFrog();
    }

    if (!frog.animating && this.pendingDir) this.startJump(this.pendingDir);

    if (frog.animating) {
      frog.animT += dt;
      if (frog.animT >= JUMP_MS) return this.land();
    }

    if (isRoadRow(frog.row) && this.checkRoadCollision()) {
      return this.killFrog();
    }

    this.timeLeft -= dt;
    if (this.timeLeft <= 0) this.killFrog();
  }

  private startJump(dir: Direction) {
    const frog = this.frog;
    this.pendingDir = null;
    const toCol = frog.col + (dir === "left" ? -1 : dir === "right" ? 1 : 0);
    const toRow = frog.row + (dir === "up" ? -1 : dir === "down" ? 1 : 0);
    if (toCol < 0 || toCol > COLS - 1 || toRow < 0 || toRow > ROWS - 1) return;
    this.facing = FACING[dir];
    frog.animating = true;
    frog.animT = 0;
    frog.fromCol = frog.col;
    frog.fromRow = frog.row;
    frog.toCol = toCol;
    frog.toRow = toRow;
  }

  // Fin del salto: coloca la rana y resuelve la celda de destino.
  private land() {
    const frog = this.frog;
    frog.animating = false;
    frog.animT = 0;
    frog.row = frog.toRow;
    frog.col = frog.toCol;
    // Fuera del río la columna vuelve a ser entera; en el río conserva la fracción del arrastre.
    if (!isRiverRow(frog.row)) {
      frog.col = Math.min(COLS - 1, Math.max(0, Math.round(frog.col)));
    }

    if (frog.row < this.furthestRow) {
      this.score += (this.furthestRow - frog.row) * POINTS_ROW;
      this.furthestRow = frog.row;
      this.emitStats();
    }

    if (frog.row === ROW_GOALS) return this.checkGoal();
    if (isRoadRow(frog.row) && this.checkRoadCollision())
      return this.killFrog();
    if (isRiverRow(frog.row) && !this.getSupport()) return this.killFrog();
  }

  private checkGoal() {
    const center = this.frog.col + 0.5;
    const i = GOALS.findIndex((g) => center >= g && center < g + GOAL_WIDTH);
    if (i < 0 || this.goals[i]) return this.killFrog(); // muro o boca ocupada

    this.goals[i] = true;
    this.score += POINTS_GOAL + Math.floor(this.timeLeft / 1000) * POINTS_TIME;
    this.furthestRow = ROW_START;
    if (this.goals.every(Boolean)) return this.completeRound();
    this.spawn();
    this.emitStats();
  }

  private completeRound() {
    this.score += POINTS_ROUND;
    this.level += 1;
    this.goals = GOALS.map(() => false);
    this.lanes = buildLanes(this.level);
    this.furthestRow = ROW_START;
    this.spawn();
    this.emitStats();
  }

  private killFrog() {
    this.lives -= 1;
    if (this.lives <= 0) {
      this.lives = 0;
      this.state = "gameover";
      this.emitStats();
      this.cb.onGameOver(this.score);
      return;
    }
    this.spawn();
    this.emitStats();
  }

  private lastStats = "";

  // Solo avisa cuando cambia algún valor.
  private emitStats(force = false) {
    const stats: GameStats = {
      score: this.score,
      level: this.level,
      lives: this.lives,
    };
    const key = `${stats.score}|${stats.level}|${stats.lives}`;
    if (!force && key === this.lastStats) return;
    this.lastStats = key;
    this.cb.onStats(stats);
  }

  private draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, W, H);
    this.drawBackground(ctx);
    this.drawGoals(ctx);
    for (const lane of this.lanes) {
      for (const e of lane.entities) this.drawEntity(ctx, lane, e);
    }
    this.drawFrog(ctx);
    this.drawTimeBar(ctx);
  }

  private drawBackground(ctx: CanvasRenderingContext2D) {
    const zone = (r0: number, r1: number, color: string) => {
      ctx.fillStyle = color;
      ctx.fillRect(0, r0 * CELL, W, (r1 - r0 + 1) * CELL);
    };
    zone(ROW_GOALS, ROW_GOALS, COLORS.wall);
    zone(ROW_RIVER_TOP, ROW_RIVER_BOT, COLORS.water);
    zone(ROW_SAFE_MID, ROW_SAFE_MID, COLORS.grass);
    zone(ROW_ROAD_TOP, ROW_ROAD_BOT, COLORS.road);
    zone(ROW_START, ROW_START, COLORS.grass);

    // Olas sutiles en el río.
    ctx.strokeStyle = COLORS.waterLine;
    ctx.lineWidth = 1;
    for (let r = ROW_RIVER_TOP; r <= ROW_RIVER_BOT; r++) {
      const y = r * CELL + CELL / 2;
      ctx.beginPath();
      for (let x = 0; x <= W; x += 8) {
        const yy = y + Math.sin((x + r * 17) / 11) * 3;
        if (x === 0) ctx.moveTo(x, yy);
        else ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }

    // Líneas discontinuas entre carriles de carretera.
    ctx.strokeStyle = COLORS.roadLine;
    ctx.setLineDash([14, 14]);
    for (let r = ROW_ROAD_TOP + 1; r <= ROW_ROAD_BOT; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * CELL);
      ctx.lineTo(W, r * CELL);
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }

  private drawGoals(ctx: CanvasRenderingContext2D) {
    GOALS.forEach((g, i) => {
      const x = g * CELL;
      const w = GOAL_WIDTH * CELL;
      ctx.fillStyle = COLORS.goal;
      ctx.fillRect(x + 2, 2, w - 4, CELL - 4);
      ctx.strokeStyle = COLORS.goalBorder;
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 3, 3, w - 6, CELL - 6);
      if (this.goals[i]) {
        this.paintFrog(ctx, x + w / 2, CELL / 2, 1, 0, false);
      }
    });
  }

  private drawEntity(ctx: CanvasRenderingContext2D, lane: Lane, e: Entity) {
    const x = e.col * CELL;
    const y = lane.row * CELL;
    const w = e.width * CELL;
    switch (e.kind) {
      case "log":
        ctx.fillStyle = COLORS.log;
        ctx.beginPath();
        ctx.roundRect(x, y + 6, w, CELL - 12, 10);
        ctx.fill();
        ctx.strokeStyle = COLORS.logLine;
        ctx.lineWidth = 2;
        for (let k = 1; k < e.width * 2; k++) {
          const lx = x + (k * w) / (e.width * 2);
          ctx.beginPath();
          ctx.moveTo(lx, y + 11);
          ctx.lineTo(lx + 4, y + CELL - 11);
          ctx.stroke();
        }
        break;
      case "turtle":
        this.drawTurtles(ctx, e, x, y);
        break;
      case "car":
        this.drawCar(ctx, lane, e, x, y, w);
        break;
      case "truck":
        this.drawTruck(ctx, lane, x, y, w);
        break;
    }
  }

  private drawTurtles(
    ctx: CanvasRenderingContext2D,
    e: Entity,
    x: number,
    y: number,
  ) {
    const phase = e.phase ?? 0;
    const under = phase >= TURTLE_UP_MS;
    // Parpadea justo antes de sumergirse para avisar al jugador.
    const warning = !under && phase >= TURTLE_UP_MS - 600;
    const blink = warning && Math.floor(phase / 150) % 2 === 0;
    for (let k = 0; k < e.width; k++) {
      const cx = x + k * CELL + CELL / 2;
      const cy = y + CELL / 2;
      ctx.beginPath();
      ctx.arc(cx, cy, 16, 0, Math.PI * 2);
      if (under) {
        ctx.strokeStyle = COLORS.shell;
        ctx.globalAlpha = 0.3;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.globalAlpha = 1;
        continue;
      }
      ctx.globalAlpha = blink ? 0.45 : 1;
      ctx.fillStyle = COLORS.shell;
      ctx.fill();
      ctx.strokeStyle = COLORS.shellLine;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, 9, 0, Math.PI * 2);
      ctx.moveTo(cx - 16, cy);
      ctx.lineTo(cx - 9, cy);
      ctx.moveTo(cx + 9, cy);
      ctx.lineTo(cx + 16, cy);
      ctx.moveTo(cx, cy - 16);
      ctx.lineTo(cx, cy - 9);
      ctx.moveTo(cx, cy + 9);
      ctx.lineTo(cx, cy + 16);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  private drawCar(
    ctx: CanvasRenderingContext2D,
    lane: Lane,
    e: Entity,
    x: number,
    y: number,
    w: number,
  ) {
    ctx.fillStyle = COLORS.cars[lane.row % COLORS.cars.length];
    ctx.beginPath();
    ctx.roundRect(x + 3, y + 8, w - 6, CELL - 16, 6);
    ctx.fill();
    // Parabrisas en el lado hacia el que avanza.
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    const wx = lane.dir === 1 ? x + w - 13 : x + 7;
    ctx.fillRect(wx, y + 12, 6, CELL - 24);
    this.drawWheels(ctx, x, y, w, e.width);
  }

  private drawTruck(
    ctx: CanvasRenderingContext2D,
    lane: Lane,
    x: number,
    y: number,
    w: number,
  ) {
    const cabW = CELL - 4;
    const cabX = lane.dir === 1 ? x + w - cabW - 2 : x + 2;
    const trailerX = lane.dir === 1 ? x + 2 : x + cabW + 4;
    ctx.fillStyle = COLORS.truckBody;
    ctx.beginPath();
    ctx.roundRect(trailerX, y + 7, w - cabW - 6, CELL - 14, 3);
    ctx.fill();
    ctx.fillStyle = COLORS.truckCab;
    ctx.beginPath();
    ctx.roundRect(cabX, y + 9, cabW, CELL - 18, 5);
    ctx.fill();
    ctx.fillStyle = COLORS.pupil;
    const wx = lane.dir === 1 ? cabX + cabW - 9 : cabX + 3;
    ctx.fillRect(wx, y + 13, 6, CELL - 26);
    this.drawWheels(ctx, x, y, w, 3);
  }

  private drawWheels(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    cells: number,
  ) {
    ctx.fillStyle = COLORS.wheel;
    const xs =
      cells >= 3 ? [x + 11, x + w / 2, x + w - 11] : [x + 11, x + w - 11];
    for (const wx of xs) {
      for (const wy of [y + 8, y + CELL - 8]) {
        ctx.beginPath();
        ctx.arc(wx, wy, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  private drawFrog(ctx: CanvasRenderingContext2D) {
    const f = this.frog;
    let col = f.col;
    let row: number = f.row;
    let leap = 0;
    if (f.animating) {
      const t = Math.min(1, f.animT / JUMP_MS);
      col = f.fromCol + (f.toCol - f.fromCol) * t;
      row = f.fromRow + (f.toRow - f.fromRow) * t;
      leap = Math.sin(t * Math.PI);
    }
    this.paintFrog(
      ctx,
      col * CELL + CELL / 2,
      row * CELL + CELL / 2,
      1 + leap * 0.25,
      this.facing,
      leap > 0.05,
    );
  }

  // Rana de primitivas: cuerpo elíptico 28×24, dos ojos y patas que se abren en el salto.
  private paintFrog(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    scale: number,
    angle: number,
    leaping: boolean,
  ) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.scale(scale, scale);
    const spread = leaping ? 6 : 0;
    ctx.fillStyle = COLORS.frogDark;
    for (const [lx, ly] of [
      [-13, -8 - spread],
      [13, -8 - spread],
      [-13, 8 + spread],
      [13, 8 + spread],
    ]) {
      ctx.beginPath();
      ctx.ellipse(lx, ly, 5, 3.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = COLORS.frog;
    ctx.beginPath();
    ctx.ellipse(0, 0, 12, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    for (const ex of [-6, 6]) {
      ctx.fillStyle = COLORS.eye;
      ctx.beginPath();
      ctx.arc(ex, -9, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = COLORS.pupil;
      ctx.beginPath();
      ctx.arc(ex, -10, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // Barra de tiempo en el borde inferior de la franja de inicio.
  private drawTimeBar(ctx: CanvasRenderingContext2D) {
    const ratio = Math.max(0, this.timeLeft / roundTimeMs(this.level));
    ctx.fillStyle =
      ratio > 0.5
        ? COLORS.timeOk
        : ratio > 0.25
          ? COLORS.timeWarn
          : COLORS.timeLow;
    ctx.fillRect(0, H - 8, W * ratio, 8);
  }
}
