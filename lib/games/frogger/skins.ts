// Skins y temas de Frogger. Igual que en Tetris, Asteroids y Snake, el motor no
// lee estilos computados del DOM: recibe aquí los valores ya resueltos por skin × tema.
//
// - classic: colores planos, sin glow ni gradientes; la rana lleva contorno plano
//   para separarse de troncos y tortugas.
// - neon: siluetas con trazo saturado y shadowBlur sobre fondo casi negro; en claro,
//   fondos pastel, tintas oscuras y sombra corta del mismo color.
// - retro: pixel art sobre rejilla de 4 px, sin suavizado, paleta PICO-8 (8 colores
//   por tema). En claro todas las entidades llevan contorno navy de 1 píxel.

export type FroggerSkin = "classic" | "neon" | "retro";
export type FroggerTheme = "dark" | "light";

export const SKIN_NAMES: FroggerSkin[] = ["classic", "neon", "retro"];
export const THEME_NAMES: FroggerTheme[] = ["dark", "light"];

export interface ThemeTokens {
  // Zonas del tablero
  wall: string; // fila 0 fuera de las bocas
  goal: string; // interior de las bocas
  goalBorder: string;
  water: string;
  waterLine: string; // olas
  grass: string; // franjas seguras
  road: string;
  roadLine: string; // separación de carriles
  // Río
  log: string;
  logLine: string; // vetas
  shell: string;
  shellLine: string;
  ripple: string; // tortuga sumergida
  // Rana
  frog: string;
  frogDark: string; // patas
  frogOutline: string;
  eye: string;
  pupil: string;
  // Carretera
  cars: string[]; // por carril (fila % longitud)
  truckBody: string;
  truckCab: string;
  carWindow: string;
  truckWindow: string;
  wheel: string;
  // Barra de tiempo: pista + relleno por tramo
  timeTrack: string;
  timeOk: string;
  timeWarn: string;
  timeLow: string;
  // Estilo
  glow: number; // shadowBlur del neón; 0 = sin glow
  outline: string | null; // contorno de vehículos y río (retro claro); null = sin contorno
}

// Paleta PICO-8 usada por retro.
const P8 = {
  black: "#000000",
  navy: "#1d2b53",
  darkGreen: "#008751",
  brown: "#ab5236",
  white: "#fff1e8",
  red: "#ff004d",
  orange: "#ffa300",
  green: "#00e436",
  blue: "#29adff",
} as const;

export const THEMES: Record<FroggerSkin, Record<FroggerTheme, ThemeTokens>> = {
  classic: {
    dark: {
      wall: "#0b2514",
      goal: "#1f7a3d",
      goalBorder: "#f2c14e",
      water: "#0a2a4d",
      waterLine: "#1d5a94",
      grass: "#12391f",
      road: "#15171d",
      roadLine: "#4a5060",
      log: "#b0703e",
      logLine: "#6b3f1d",
      shell: "#3fae5a",
      shellLine: "#1f6b33",
      ripple: "#4a8cc0",
      frog: "#8dff4a",
      frogDark: "#4fb82a",
      frogOutline: "#06140a",
      eye: "#ffffff",
      pupil: "#0a1f0a",
      cars: ["#e5483f", "#f2c14e", "#3d8bff", "#c46bff", "#ff8a3d"],
      truckBody: "#8b93a3",
      truckCab: "#d8dde6",
      carWindow: "#e8f1ff",
      truckWindow: "#0a1f0a",
      wheel: "#000000",
      timeTrack: "#06140a",
      timeOk: "#4cd964",
      timeWarn: "#f2c14e",
      timeLow: "#ff453a",
      glow: 0,
      outline: null,
    },
    light: {
      wall: "#2f6b3a",
      goal: "#dcf3d3",
      goalBorder: "#8a5a00",
      water: "#bfe0f5",
      waterLine: "#6fa8d3",
      grass: "#cfe8c4",
      road: "#e2e4e9",
      roadLine: "#8d93a1",
      log: "#7a4a1f",
      logLine: "#4a2a0e",
      shell: "#1f7a3a",
      shellLine: "#0d4420",
      ripple: "#2f6f9f",
      frog: "#1f7a12",
      frogDark: "#145c0b",
      frogOutline: "#fffbe6",
      eye: "#ffffff",
      pupil: "#0a1f0a",
      cars: ["#c62828", "#a15c00", "#1f5fd1", "#7b2cbf", "#c2410c"],
      truckBody: "#4b5563",
      truckCab: "#1f2937",
      carWindow: "#e8f1ff",
      truckWindow: "#bfe0f5",
      wheel: "#111318",
      timeTrack: "#1f3d24",
      timeOk: "#4cd964",
      timeWarn: "#f2c14e",
      timeLow: "#ff5a4f",
      glow: 0,
      outline: null,
    },
  },
  neon: {
    dark: {
      wall: "#04140a",
      goal: "#03200f",
      goalBorder: "#ffe600",
      water: "#020b1f",
      waterLine: "#0f3f8a",
      grass: "#03140a",
      road: "#07070d",
      roadLine: "#6a1450",
      log: "#ff9a3c",
      logLine: "#ff9a3c",
      shell: "#39ff14",
      shellLine: "#39ff14",
      ripple: "#2f7bff",
      frog: "#b6ff00",
      frogDark: "#6dff3a",
      frogOutline: "#000000",
      eye: "#ffffff",
      pupil: "#000000",
      cars: ["#ff2d95", "#ffe600", "#00e5ff", "#b44dff", "#ff6a00"],
      truckBody: "#00e5ff",
      truckCab: "#e0fbff",
      carWindow: "#ffffff",
      truckWindow: "#020b1f",
      wheel: "#000000",
      timeTrack: "#000000",
      timeOk: "#39ff14",
      timeWarn: "#ffe600",
      timeLow: "#ff2d55",
      glow: 12,
      outline: null,
    },
    // El glow claro-sobre-negro desaparece en claro: tintas oscuras y
    // saturadas sobre fondos pastel, con una sombra corta del mismo color.
    light: {
      wall: "#d9ccf7",
      goal: "#f3edff",
      goalBorder: "#7a00d6",
      water: "#e2f0ff",
      waterLine: "#9cc4f2",
      grass: "#e4f7e8",
      road: "#f2f0f8",
      roadLine: "#d48ab8",
      log: "#b4470a",
      logLine: "#b4470a",
      shell: "#00873c",
      shellLine: "#00873c",
      ripple: "#2563eb",
      frog: "#0a8f00",
      frogDark: "#066600",
      frogOutline: "#ffffff",
      eye: "#ffffff",
      pupil: "#0a0a14",
      cars: ["#d1006b", "#9a5f00", "#0062c4", "#7a00d6", "#c24e00"],
      truckBody: "#006d8f",
      truckCab: "#004a63",
      carWindow: "#ffffff",
      truckWindow: "#e2f0ff",
      wheel: "#1a1030",
      timeTrack: "#3b0764",
      timeOk: "#39ff14",
      timeWarn: "#ffe600",
      timeLow: "#ff4d6d",
      glow: 5,
      outline: null,
    },
  },
  // Oscuro: negro, navy, verde oscuro, marrón, crema, rojo, naranja y verde (8).
  retro: {
    dark: {
      wall: P8.darkGreen,
      goal: P8.navy,
      goalBorder: P8.orange,
      water: P8.navy,
      waterLine: P8.black,
      grass: P8.darkGreen,
      road: P8.black,
      roadLine: P8.white,
      log: P8.orange,
      logLine: P8.brown,
      shell: P8.red,
      shellLine: P8.brown,
      ripple: P8.white,
      frog: P8.green,
      frogDark: P8.darkGreen,
      frogOutline: P8.black,
      eye: P8.white,
      pupil: P8.black,
      cars: [P8.red, P8.orange, P8.white, P8.red, P8.orange],
      truckBody: P8.white,
      truckCab: P8.red,
      carWindow: P8.navy,
      truckWindow: P8.navy,
      wheel: P8.brown,
      timeTrack: P8.black,
      timeOk: P8.green,
      timeWarn: P8.orange,
      timeLow: P8.red,
      glow: 0,
      outline: null,
    },
    // Claro: verde oscuro, azul, navy, verde, crema, marrón, rojo y naranja (8).
    // Los tonos vivos no llegan a 3:1 sobre crema o azul: contorno navy.
    light: {
      wall: P8.darkGreen,
      goal: P8.blue,
      goalBorder: P8.navy,
      water: P8.blue,
      waterLine: P8.white,
      grass: P8.green,
      road: P8.white,
      roadLine: P8.navy,
      log: P8.orange,
      logLine: P8.brown,
      shell: P8.red,
      shellLine: P8.navy,
      ripple: P8.navy,
      frog: P8.darkGreen,
      frogDark: P8.green,
      frogOutline: P8.navy,
      eye: P8.white,
      pupil: P8.navy,
      cars: [P8.red, P8.orange, P8.darkGreen, P8.red, P8.brown],
      truckBody: P8.brown,
      truckCab: P8.navy,
      carWindow: P8.blue,
      truckWindow: P8.blue,
      wheel: P8.navy,
      timeTrack: P8.navy,
      timeOk: P8.green,
      timeWarn: P8.orange,
      timeLow: P8.red,
      glow: 0,
      outline: P8.navy,
    },
  },
};
