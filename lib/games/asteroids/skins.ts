// Skins y temas de Asteroids. Igual que en Tetris, el motor no lee estilos
// computados del DOM: recibe aquí los valores ya resueltos por skin × tema.
//
// - classic: trazos planos, sin glow ni gradientes.
// - neon: trazos saturados con shadowBlur; en claro, sombra suave y tintas oscuras.
// - retro: rejilla de píxeles duros (sin antialias) y paleta de ≤ 8 colores.

export type AsteroidsSkin = "classic" | "neon" | "retro";
export type AsteroidsTheme = "dark" | "light";

export const SKIN_NAMES: AsteroidsSkin[] = ["classic", "neon", "retro"];
export const THEME_NAMES: AsteroidsTheme[] = ["dark", "light"];

export interface ThemeTokens {
  background: string;
  ship: string;
  thrust: string; // llama del propulsor
  asteroid: string;
  bullet: string;
  particle: string; // chispas de las explosiones
  triple: string; // power-up de disparo triple y su contador
  shield: string; // power-up de escudo, anillo y contador
  lineWidth: number; // grosor de trazo en modo vectorial
  glow: number; // shadowBlur del neón; 0 = sin glow
  pixel: number; // tamaño del «píxel» retro; 0 = dibujo vectorial
  font: string; // contadores de power-ups dentro del canvas
}

const VECTOR_FONT = "13px monospace";
const RETRO_FONT = "bold 14px monospace";

export const THEMES: Record<
  AsteroidsSkin,
  Record<AsteroidsTheme, ThemeTokens>
> = {
  classic: {
    dark: {
      background: "#0a0a0f",
      ship: "#ffffff",
      thrust: "#ff8c1a",
      asteroid: "#e6e9ff",
      bullet: "#ffffff",
      particle: "#e6e9ff",
      triple: "#22d3ee",
      shield: "#34d399",
      lineWidth: 1.5,
      glow: 0,
      pixel: 0,
      font: VECTOR_FONT,
    },
    light: {
      background: "#f4f5fa",
      ship: "#10121c",
      thrust: "#c2410c",
      asteroid: "#2a2d3e",
      bullet: "#10121c",
      particle: "#2a2d3e",
      triple: "#0e7490",
      shield: "#047857",
      lineWidth: 2,
      glow: 0,
      pixel: 0,
      font: VECTOR_FONT,
    },
  },
  neon: {
    dark: {
      background: "#05050a",
      ship: "#00f5ff",
      thrust: "#ff9100",
      asteroid: "#ff2d95",
      bullet: "#f5ff00",
      particle: "#ff6ec7",
      triple: "#00f5ff",
      shield: "#00ff88",
      lineWidth: 2,
      glow: 14,
      pixel: 0,
      font: VECTOR_FONT,
    },
    // El glow blanco-sobre-negro desaparece en claro: tintas oscuras y
    // saturadas con una sombra corta del mismo color.
    light: {
      background: "#f6f2ff",
      ship: "#00708a",
      thrust: "#c2410c",
      asteroid: "#c0005a",
      bullet: "#6d28d9",
      particle: "#c0005a",
      triple: "#00708a",
      shield: "#047857",
      lineWidth: 2.25,
      glow: 6,
      pixel: 0,
      font: VECTOR_FONT,
    },
  },
  // Paleta PICO-8: 8 colores en oscuro (fondo incluido) y 7 en claro.
  retro: {
    dark: {
      background: "#1d2b53",
      ship: "#fff1e8",
      thrust: "#ffa300",
      asteroid: "#c2c3c7",
      bullet: "#ffec27",
      particle: "#ff77a8",
      triple: "#29adff",
      shield: "#00e436",
      lineWidth: 0,
      glow: 0,
      pixel: 3,
      font: RETRO_FONT,
    },
    light: {
      background: "#fff1e8",
      ship: "#1d2b53",
      thrust: "#ab5236",
      asteroid: "#5f574f",
      bullet: "#7e2553",
      particle: "#ab5236",
      triple: "#065ab5",
      shield: "#006b40", // verde PICO-8 oscurecido: el contador necesita ≥ 4.5:1
      lineWidth: 0,
      glow: 0,
      pixel: 3,
      font: RETRO_FONT,
    },
  },
};
