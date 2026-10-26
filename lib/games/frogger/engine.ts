// Motor de Frogger (SPEC 11). No tiene juego de referencia: las constantes se definen en el spec.
// Recibe un <canvas> y avisa a React por callbacks; no conoce React ni el DOM global.

import type { GameCallbacks, GameStats } from "../engine";

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

const isRiverRow = (row: number) =>
  row >= ROW_RIVER_TOP && row <= ROW_RIVER_BOT;
const isRoadRow = (row: number) => row >= ROW_ROAD_TOP && row <= ROW_ROAD_BOT;
const isSubmerged = (e: Entity) =>
  e.kind === "turtle" && (e.phase ?? 0) >= TURTLE_UP_MS;
const covers = (e: Entity, center: number) =>
  center >= e.col && center < e.col + e.width;

export class FroggerEngine {
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

  constructor(
    private canvas: HTMLCanvasElement,
    private cb: GameCallbacks,
  ) {
    this.reset();
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
  private emitStats() {
    const stats: GameStats = {
      score: this.score,
      level: this.level,
      lives: this.lives,
    };
    const key = `${stats.score}|${stats.level}|${stats.lives}`;
    if (key === this.lastStats) return;
    this.lastStats = key;
    this.cb.onStats(stats);
  }
}
