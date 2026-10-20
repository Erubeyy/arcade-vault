// Niveles de Arkanoid portados de references/started-games/04-arkanoid/levels.js.
// Sin DOM ni estado de módulo.

export type BlockColor =
  "gray" | "red" | "yellow" | "cyan" | "magenta" | "hotpink" | "green";

export interface Level {
  speed: number; // px/s, magnitud constante de la bola
  rows: string[]; // hasta 10 filas de 10 caracteres
}

// '.' vacío | g gris | r rojo | y amarillo | c cian | m magenta | h rosa | e verde
export const LEVEL_CHARS: Record<string, BlockColor> = {
  g: "gray",
  r: "red",
  y: "yellow",
  c: "cyan",
  m: "magenta",
  h: "hotpink",
  e: "green",
};

export const LEVELS: Level[] = [
  {
    // 1 - Classic
    speed: 360,
    rows: [
      "gggggggggg",
      "rrrrrrrrrr",
      "yyyyyyyyyy",
      "cccccccccc",
      "mmmmmmmmmm",
      "eeeeeeeeee",
    ],
  },
  {
    // 2 - Pyramid
    speed: 390,
    rows: [
      "....gg....",
      "...rrrr...",
      "..yyyyyy..",
      ".cccccccc.",
      "mmmmmmmmmm",
      "hhhhhhhhhh",
    ],
  },
  {
    // 3 - Checkerboard
    speed: 420,
    rows: [
      "g.g.g.g.g.",
      ".y.y.y.y.y",
      "c.c.c.c.c.",
      ".m.m.m.m.m",
      "h.h.h.h.h.",
      ".e.e.e.e.e",
    ],
  },
  {
    // 4 - Diamond
    speed: 450,
    rows: [
      "....cc....",
      "...cyyc...",
      "..cyggyc..",
      ".cyg..gyc.",
      ".cyg..gyc.",
      "..cyggyc..",
      "...cyyc...",
      "....cc....",
    ],
  },
  {
    // 5 - Pillars
    speed: 480,
    rows: [
      "gg..gg..gg",
      "rr..cc..mm",
      "rr..cc..mm",
      "rr..cc..mm",
      "yy..ee..hh",
      "yy..ee..hh",
      "yy..ee..hh",
      "yy..ee..hh",
    ],
  },
  {
    // 6 - Invader
    speed: 510,
    rows: [
      "..e....e..",
      "...e..e...",
      "..eeeeee..",
      ".ee.ee.ee.",
      "gggggggggg",
      "e.eeeeee.e",
      "e.e....e.e",
      "..ee..ee..",
    ],
  },
  {
    // 7 - Fortress
    speed: 540,
    rows: [
      "gggggggggg",
      "g........g",
      "g.rrrrrr.g",
      "g.ryyyyr.g",
      "g.rymmyr.g",
      "g.ryyyyr.g",
      "g.rrrrrr.g",
      "g........g",
      "gggggggggg",
    ],
  },
  {
    // 8 - X
    speed: 570,
    rows: [
      "hh......hh",
      ".hh....hh.",
      "..hh..hh..",
      "...hggh...",
      "....gg....",
      "....gg....",
      "...hggh...",
      "..hh..hh..",
      ".hh....hh.",
      "hh......hh",
    ],
  },
];
