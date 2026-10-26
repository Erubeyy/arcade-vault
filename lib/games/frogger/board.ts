// Geometría del tablero de Frogger (SPEC 11), compartida por el motor y el dibujo.

export const W = 640;
export const H = 560;

export const CELL = 40;
export const COLS = W / CELL; // 16
export const ROWS = H / CELL; // 14

// Filas (0 = arriba)
export const ROW_GOALS = 0;
export const ROW_RIVER_TOP = 1;
export const ROW_RIVER_BOT = 6;
export const ROW_SAFE_MID = 7;
export const ROW_ROAD_TOP = 8;
export const ROW_ROAD_BOT = 12;
export const ROW_START = 13;

export const GOALS = [1, 4, 7, 10, 13]; // columna inicial de cada boca (ancho 2)
export const GOAL_WIDTH = 2;

export type EntityKind = "car" | "truck" | "log" | "turtle";
