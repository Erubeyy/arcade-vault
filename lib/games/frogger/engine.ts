// Motor de Frogger (SPEC 11). No tiene juego de referencia: las constantes se definen en el spec.
// Recibe un <canvas> y avisa a React por callbacks; no conoce React ni el DOM global.

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
