// Constantes y piezas de Tetris portadas de references/started-games/03-tetris/game.js.
// Sin DOM ni estado de módulo: el estado vive en TetrisEngine.

export const COLS = 10;
export const ROWS = 20;
export const BLOCK = 30;

export type Shape = number[][];

export interface Piece {
  type: number; // 1–7: I, O, T, S, Z, J, L (también es el índice de color)
  shape: Shape;
  x: number;
  y: number;
}

// Índice 0 sin usar; 1–7 son I, O, T, S, Z, J, L.
export const PIECES: (Shape | null)[] = [
  null,
  [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ], // I
  [
    [2, 2],
    [2, 2],
  ], // O
  [
    [0, 3, 0],
    [3, 3, 3],
    [0, 0, 0],
  ], // T
  [
    [0, 4, 4],
    [4, 4, 0],
    [0, 0, 0],
  ], // S
  [
    [5, 5, 0],
    [0, 5, 5],
    [0, 0, 0],
  ], // Z
  [
    [6, 0, 0],
    [6, 6, 6],
    [0, 0, 0],
  ], // J
  [
    [0, 0, 7],
    [7, 7, 7],
    [0, 0, 0],
  ], // L
];

export const LINE_SCORES = [0, 100, 300, 500, 800];

// Desplazamientos de columna que prueba la rotación antes de descartarse.
export const KICKS = [0, -1, 1, -2, 2];

export function createBoard(): number[][] {
  return Array.from({ length: ROWS }, () => new Array<number>(COLS).fill(0));
}

export function randomPiece(): Piece {
  const type = Math.floor(Math.random() * 7) + 1;
  const shape = PIECES[type]!.map((row) => [...row]);
  return {
    type,
    shape,
    x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2),
    y: 0,
  };
}

export function rotateCW(shape: Shape): Shape {
  const rows = shape.length;
  const cols = shape[0].length;
  const result = Array.from({ length: cols }, () =>
    new Array<number>(rows).fill(0),
  );
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) result[c][rows - 1 - r] = shape[r][c];
  return result;
}

// Milisegundos entre caídas automáticas para un nivel.
export function intervalForLevel(level: number): number {
  return Math.max(100, 1000 - (level - 1) * 90);
}
