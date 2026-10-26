// Motor de Frogger (SPEC 11). No tiene juego de referencia: las constantes se definen en el spec.
// Recibe un <canvas> y avisa a React por callbacks; no conoce React ni el DOM global.

import type {
  GameCallbacks,
  GameEngine,
  GameStats,
  VirtualButton,
} from "../engine";
import {
  CELL,
  COLS,
  GOALS,
  GOAL_WIDTH,
  H,
  ROWS,
  ROW_GOALS,
  ROW_RIVER_BOT,
  ROW_RIVER_TOP,
  ROW_ROAD_BOT,
  ROW_ROAD_TOP,
  ROW_START,
  W,
  type EntityKind,
} from "./board";
import { Renderer, type SceneEntity } from "./render";
import {
  SKIN_NAMES,
  THEMES,
  THEME_NAMES,
  type FroggerSkin,
  type FroggerTheme,
} from "./skins";

export { W, H };
export type { FroggerSkin, FroggerTheme };

// Opciones de apariencia: solo cambian el dibujo, nunca la partida.
export interface FroggerOptions {
  skin: FroggerSkin;
  theme: FroggerTheme;
}

const DEFAULTS: FroggerOptions = { skin: "classic", theme: "dark" };

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
  private renderer: Renderer;
  private skin: FroggerSkin;
  private theme: FroggerTheme;

  private started = false;
  private paused = false;
  private destroyed = false;
  private listening = false;
  private rafId: number | null = null;
  private lastTime: number | null = null;

  constructor(
    private canvas: HTMLCanvasElement,
    private cb: GameCallbacks,
    options?: Partial<FroggerOptions>,
  ) {
    // Valores inválidos (p. ej. preferencias corruptas) caen a los de serie.
    this.skin = SKIN_NAMES.includes(options?.skin as FroggerSkin)
      ? (options!.skin as FroggerSkin)
      : DEFAULTS.skin;
    this.theme = THEME_NAMES.includes(options?.theme as FroggerTheme)
      ? (options!.theme as FroggerTheme)
      : DEFAULTS.theme;
    this.renderer = new Renderer(
      canvas.getContext("2d")!,
      this.skin,
      THEMES[this.skin][this.theme],
    );
    this.reset();
  }

  // ── Apariencia (solo dibujo; no afecta a la partida) ───────────────────────

  setSkin(skin: FroggerSkin) {
    if (!SKIN_NAMES.includes(skin)) return;
    this.skin = skin;
    this.applyLook();
  }

  setTheme(theme: FroggerTheme) {
    if (!THEME_NAMES.includes(theme)) return;
    this.theme = theme;
    this.applyLook();
  }

  private applyLook() {
    this.renderer.skin = this.skin;
    this.renderer.t = THEMES[this.skin][this.theme];
    // Repinta ya, por si el bucle está detenido (pausa o fin de partida).
    if (!this.destroyed) this.draw();
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

  // Traduce el estado a una escena en píxeles; el Renderer decide cómo pintarla.
  private draw() {
    const entities: SceneEntity[] = [];
    for (const lane of this.lanes) {
      for (const e of lane.entities) {
        let look: SceneEntity["look"] = "full";
        if (e.kind === "turtle") {
          const phase = e.phase ?? 0;
          // Parpadea justo antes de sumergirse para avisar al jugador.
          const warning = phase < TURTLE_UP_MS && phase >= TURTLE_UP_MS - 600;
          if (isSubmerged(e)) look = "under";
          else if (warning && Math.floor(phase / 150) % 2 === 0) look = "blink";
        }
        entities.push({
          kind: e.kind,
          x: e.col * CELL,
          y: lane.row * CELL,
          cells: e.width,
          dir: lane.dir,
          row: lane.row,
          look,
        });
      }
    }

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

    this.renderer.draw({
      entities,
      goals: this.goals,
      frog: {
        cx: col * CELL + CELL / 2,
        cy: row * CELL + CELL / 2,
        scale: 1 + leap * 0.25,
        angle: this.facing,
        leaping: leap > 0.05,
      },
      timeRatio: Math.max(0, this.timeLeft / roundTimeMs(this.level)),
    });
  }
}
