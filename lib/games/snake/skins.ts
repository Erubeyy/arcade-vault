// Skins y temas de Snake. Igual que en Tetris y Asteroids, el motor no lee
// estilos computados del DOM: recibe aquí los valores ya resueltos por skin × tema.
//
// - classic: colores planos, sin glow ni gradientes.
// - neon: serpiente saturada con shadowBlur; en claro, tintas oscuras y sombra corta.
// - retro: bloques de píxeles duros, frutas en pixel art y paleta PICO-8 (≤ 8 colores).

export type SnakeSkin = "classic" | "neon" | "retro";
export type SnakeTheme = "dark" | "light";

export const SKIN_NAMES: SnakeSkin[] = ["classic", "neon", "retro"];
export const THEME_NAMES: SnakeTheme[] = ["dark", "light"];

// Colores de las frutas en pixel art (solo retro), por familia de color.
export type FruitTint =
  "red" | "orange" | "yellow" | "pink" | "green" | "white";

export interface ThemeTokens {
  background: string;
  grid: string | null; // null = sin rejilla
  head: string;
  body: string;
  tail: string; // último tercio del cuerpo
  scale: string | null; // retro: «escama» central de cada segmento
  eye: string;
  fruitFallback: string; // fruta sin atlas (error de carga)
  fruitGlow: string; // color del glow de la fruta (solo neón)
  glow: number; // shadowBlur del neón; 0 = sin glow
  radius: number; // redondeo de los segmentos; 0 = bordes duros
  pixel: number; // tamaño del «píxel» retro; 0 = dibujo vectorial
  // Retro: paleta de las frutas en pixel art y contorno (null = sin contorno).
  fruitTints: Record<FruitTint, string> | null;
  fruitLeaf: string;
  fruitShine: string;
  fruitOutline: string | null; // contorno de la fruta (retro y temas claros)
}

const VECTOR = {
  scale: null,
  pixel: 0,
  fruitTints: null,
  fruitLeaf: "",
  fruitShine: "",
  fruitOutline: null,
} as const;

export const THEMES: Record<SnakeSkin, Record<SnakeTheme, ThemeTokens>> = {
  classic: {
    dark: {
      ...VECTOR,
      background: "#0b0e14",
      grid: "rgba(255, 255, 255, 0.05)",
      head: "#4ade80",
      body: "#22c55e",
      tail: "#16a34a",
      eye: "#0b0e14",
      fruitFallback: "#f43f5e",
      fruitGlow: "",
      glow: 0,
      radius: 8,
    },
    light: {
      ...VECTOR,
      background: "#f4f5fa",
      grid: "rgba(16, 18, 28, 0.08)",
      head: "#14532d",
      body: "#166534",
      tail: "#15803d",
      eye: "#f4f5fa",
      fruitFallback: "#be123c",
      fruitGlow: "",
      glow: 0,
      radius: 8,
      fruitOutline: "#2a2d3e",
    },
  },
  neon: {
    dark: {
      ...VECTOR,
      background: "#05080a",
      grid: "rgba(0, 255, 136, 0.06)",
      head: "#39ff14",
      body: "#00ff88",
      tail: "#00e5ff",
      eye: "#05080a",
      fruitFallback: "#ff2d95",
      fruitGlow: "#ff2d95",
      glow: 14,
      radius: 10,
    },
    // El glow claro-sobre-negro desaparece en claro: tintas oscuras y
    // saturadas con una sombra corta del mismo color.
    light: {
      ...VECTOR,
      background: "#f6f2ff",
      grid: "rgba(109, 40, 217, 0.08)",
      head: "#006b3c",
      body: "#00804a",
      tail: "#00708a",
      eye: "#f6f2ff",
      fruitFallback: "#c0005a",
      fruitGlow: "#c0005a",
      glow: 6,
      radius: 10,
      fruitOutline: "#3b0764",
    },
  },
  // Paleta PICO-8. Oscuro: 8 colores (fondo incluido). Claro: 8 colores.
  retro: {
    dark: {
      background: "#1d2b53",
      grid: null,
      head: "#00e436",
      body: "#00e436",
      tail: "#00e436",
      scale: "#008751",
      eye: "#1d2b53",
      fruitFallback: "#ff004d",
      fruitGlow: "",
      glow: 0,
      radius: 0,
      pixel: 4,
      fruitTints: {
        red: "#ff004d",
        orange: "#ffa300",
        yellow: "#ffec27",
        pink: "#ff77a8",
        green: "#00e436",
        white: "#fff1e8",
      },
      fruitLeaf: "#008751",
      fruitShine: "#fff1e8",
      fruitOutline: null,
    },
    // En claro los tonos vivos (amarillo, naranja) no llegan a 3:1 sobre el
    // fondo crema: las frutas llevan contorno oscuro de 1 píxel.
    light: {
      background: "#fff1e8",
      grid: null,
      head: "#1d2b53",
      body: "#008751",
      tail: "#008751",
      scale: "#1d2b53",
      eye: "#fff1e8",
      fruitFallback: "#ff004d",
      fruitGlow: "",
      glow: 0,
      radius: 0,
      pixel: 4,
      fruitTints: {
        red: "#ff004d",
        orange: "#ffa300",
        yellow: "#ffec27",
        pink: "#ff77a8",
        green: "#00e436",
        white: "#fff1e8",
      },
      fruitLeaf: "#008751",
      fruitShine: "#fff1e8",
      fruitOutline: "#1d2b53",
    },
  },
};
