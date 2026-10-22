// Skins y temas de Arkanoid. Igual que en Tetris y Asteroids, el motor no lee
// estilos computados del DOM: recibe aquí los valores ya resueltos por skin × tema.
//
// - classic: colores planos, sin glow ni gradientes.
// - neon: contornos saturados con shadowBlur; en claro, sombra corta y tintas oscuras.
// - retro: rejilla de píxeles de 4 px, sin suavizado y paleta de ≤ 8 colores (PICO-8).
// - arcade (extra): el spritesheet original del juego.

import type { BlockColor } from "./levels";

export type ArkanoidSkin = "classic" | "neon" | "retro" | "arcade";
export type ArkanoidTheme = "dark" | "light";

export const SKIN_NAMES: ArkanoidSkin[] = [
  "classic",
  "neon",
  "retro",
  "arcade",
];
export const THEME_NAMES: ArkanoidTheme[] = ["dark", "light"];

export interface ThemeTokens {
  background: string;
  blocks: Record<BlockColor, string>;
  paddle: string;
  paddleAccent: string; // extremos de la paleta
  ball: string;
  text: string; // pista «ESPACIO PARA LANZAR»
  shine: string; // brillo de los bloques retro
  outline: string | null; // contorno de los sprites sobre fondo claro
  glow: number; // shadowBlur del neón; 0 = sin glow
  fillAlpha: number; // opacidad del relleno de bloques neón
  font: string;
}

const FONT = "20px monospace";
const RETRO_FONT = "bold 20px monospace";

const CLASSIC_DARK: ThemeTokens = {
  background: "#0a0a0f",
  blocks: {
    gray: "#9ca3af",
    red: "#ef4444",
    yellow: "#facc15",
    cyan: "#22d3ee",
    magenta: "#d946ef",
    hotpink: "#f472b6",
    green: "#22c55e",
  },
  paddle: "#e5e7eb",
  paddleAccent: "#ef4444",
  ball: "#ffffff",
  text: "#ffffff",
  shine: "#ffffff",
  outline: null,
  glow: 0,
  fillAlpha: 1,
  font: FONT,
};

const CLASSIC_LIGHT: ThemeTokens = {
  background: "#f4f5fa",
  blocks: {
    gray: "#4b5563",
    red: "#b91c1c",
    yellow: "#a16207",
    cyan: "#0e7490",
    magenta: "#a21caf",
    hotpink: "#be185d",
    green: "#15803d",
  },
  paddle: "#1f2937",
  paddleAccent: "#b91c1c",
  ball: "#10121c",
  text: "#10121c",
  shine: "#f4f5fa",
  outline: null,
  glow: 0,
  fillAlpha: 1,
  font: FONT,
};

export const THEMES: Record<
  ArkanoidSkin,
  Record<ArkanoidTheme, ThemeTokens>
> = {
  classic: { dark: CLASSIC_DARK, light: CLASSIC_LIGHT },
  neon: {
    dark: {
      background: "#05050a",
      blocks: {
        gray: "#c4c8ff",
        red: "#ff3355",
        yellow: "#f5ff00",
        cyan: "#00f5ff",
        magenta: "#ff00ff",
        hotpink: "#ff2d95",
        green: "#00ff88",
      },
      paddle: "#00f5ff",
      paddleAccent: "#ff2d95",
      ball: "#f5ff00",
      text: "#00f5ff",
      shine: "#ffffff",
      outline: null,
      glow: 14,
      fillAlpha: 0.22,
      font: FONT,
    },
    // El glow claro-sobre-negro desaparece en claro: tintas oscuras y
    // saturadas con una sombra corta del mismo color.
    light: {
      background: "#f6f2ff",
      blocks: {
        gray: "#4a4e7a",
        red: "#c8102e",
        yellow: "#8a6a00",
        cyan: "#00708a",
        magenta: "#9d00a8",
        hotpink: "#c0005a",
        green: "#047857",
      },
      paddle: "#6d28d9",
      paddleAccent: "#c0005a",
      ball: "#6d28d9",
      text: "#3b0a8f",
      shine: "#ffffff",
      outline: null,
      glow: 6,
      fillAlpha: 0.16,
      font: FONT,
    },
  },
  // Paleta PICO-8: 8 colores por tema, fondo incluido.
  retro: {
    dark: {
      background: "#000000",
      blocks: {
        gray: "#c2c3c7",
        red: "#ff004d",
        yellow: "#ffec27",
        cyan: "#29adff",
        magenta: "#83769c",
        hotpink: "#ff77a8",
        green: "#00e436",
      },
      paddle: "#c2c3c7",
      paddleAccent: "#ff004d",
      ball: "#ffec27",
      text: "#c2c3c7",
      shine: "#c2c3c7",
      outline: null,
      glow: 0,
      fillAlpha: 1,
      font: RETRO_FONT,
    },
    // Amarillo, cian y rosa PICO-8 no llegan a 3:1 sobre crema: se sustituyen
    // por marrón, azul oscuro y rojo de la misma paleta.
    light: {
      background: "#fff1e8",
      blocks: {
        gray: "#5f574f",
        red: "#ff004d",
        yellow: "#ab5236",
        cyan: "#065ab5",
        magenta: "#7e2553",
        hotpink: "#ff004d",
        green: "#008751",
      },
      paddle: "#1d2b53",
      paddleAccent: "#ff004d",
      ball: "#1d2b53",
      text: "#1d2b53",
      shine: "#fff1e8",
      outline: null,
      glow: 0,
      fillAlpha: 1,
      font: RETRO_FONT,
    },
  },
  // Los colores planos solo se usan mientras carga el spritesheet.
  arcade: {
    dark: { ...CLASSIC_DARK, background: "#000000" },
    // La bola y la paleta del spritesheet son gris claro: en claro llevan contorno.
    light: { ...CLASSIC_LIGHT, background: "#e8ebf4", outline: "#10121c" },
  },
};
