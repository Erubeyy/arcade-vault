// Skins y temas de Tetris, copiados de references/started-games/03-tetris/game.js
// (SKINS) y style.css (variables --surface, --grid y --ghost-alpha). El motor no
// lee estilos computados: los valores resueltos viven en THEMES.

export type TetrisSkin = "retro" | "neon" | "pastel" | "pixel";
export type TetrisTheme = "dark" | "light";

export const SKIN_NAMES: TetrisSkin[] = ["retro", "neon", "pastel", "pixel"];
export const THEME_NAMES: TetrisTheme[] = ["dark", "light"];

export interface Skin {
  colors: (string | null)[]; // índices 1–7, igual que PIECES
  // (px, py) es la esquina del bloque en píxeles; el alpha lo fija drawBlock.
  draw(
    ctx: CanvasRenderingContext2D,
    px: number,
    py: number,
    size: number,
    color: string,
  ): void;
}

export const SKINS: Record<TetrisSkin, Skin> = {
  retro: {
    colors: [
      null,
      "#4dd0e1", // I
      "#ffd54f", // O
      "#ba68c8", // T
      "#81c784", // S
      "#e57373", // Z
      "#90caf9", // J
      "#ffb74d", // L
    ],
    draw(ctx, px, py, size, color) {
      ctx.fillStyle = color;
      ctx.fillRect(px + 1, py + 1, size - 2, size - 2);
      ctx.fillStyle = "rgba(255,255,255,0.12)";
      ctx.fillRect(px + 1, py + 1, size - 2, 4);
    },
  },
  neon: {
    colors: [
      null,
      "#00f0ff",
      "#ffe600",
      "#d500f9",
      "#39ff14",
      "#ff1744",
      "#448aff",
      "#ff9100",
    ],
    draw(ctx, px, py, size, color) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 12;
      ctx.fillStyle = "rgba(0,0,0,0.85)";
      ctx.fillRect(px + 3, py + 3, size - 6, size - 6);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.strokeRect(px + 3, py + 3, size - 6, size - 6);
      ctx.shadowBlur = 0;
      ctx.fillStyle = color;
      ctx.globalAlpha *= 0.35;
      ctx.fillRect(px + 6, py + 6, size - 12, size - 12);
    },
  },
  pastel: {
    colors: [
      null,
      "#a8e6ef",
      "#fff1b3",
      "#d7bde2",
      "#b9e6c1",
      "#f7b9b9",
      "#b5d3f5",
      "#ffd3a8",
    ],
    draw(ctx, px, py, size, color) {
      const r = size * 0.28;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(px + 2, py + 2, size - 4, size - 4, r);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.45)";
      ctx.beginPath();
      ctx.roundRect(px + 6, py + 5, size - 12, size * 0.18, size * 0.09);
      ctx.fill();
    },
  },
  pixel: {
    colors: [
      null,
      "#29b6f6",
      "#fdd835",
      "#ab47bc",
      "#66bb6a",
      "#ef5350",
      "#5c6bc0",
      "#ff9800",
    ],
    draw(ctx, px, py, size, color) {
      const p = Math.floor(size / 6); // «píxel» de la textura
      const inner = p * 6;
      const ox = px + Math.floor((size - inner) / 2);
      const oy = py + Math.floor((size - inner) / 2);
      ctx.fillStyle = color;
      ctx.fillRect(ox, oy, inner, inner);
      // sombra (abajo/derecha), luz (arriba/izquierda) y trama de ajedrez en el centro
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.fillRect(ox, oy + inner - p, inner, p);
      ctx.fillRect(ox + inner - p, oy, p, inner);
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      ctx.fillRect(ox, oy, inner - p, p);
      ctx.fillRect(ox, oy, p, inner - p);
      for (let i = 1; i < 5; i++)
        for (let j = 1; j < 5; j++)
          if ((i + j) % 2 === 0) {
            ctx.fillStyle = "rgba(0,0,0,0.12)";
            ctx.fillRect(ox + i * p, oy + j * p, p, p);
          }
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.fillRect(ox + p, oy + p, p, p);
    },
  },
};

export interface ThemeTokens {
  background: string; // --surface del tablero
  grid: string; // --grid
  ghostAlpha: number; // --ghost-alpha
}

// Valores resueltos de style.css para cada combinación skin × tema. En la hoja
// original `neon` se declara después de los temas y los pisa, así que no
// distingue entre oscuro y claro; `pixel` no redefine nada y usa el tema base.
const BASE: Record<TetrisTheme, ThemeTokens> = {
  dark: { background: "#1a1a25", grid: "#22222e", ghostAlpha: 0.2 },
  light: { background: "#ffffff", grid: "#e3e5ee", ghostAlpha: 0.4 },
};

const NEON: ThemeTokens = {
  background: "#05050a",
  grid: "#0b1a24",
  ghostAlpha: 0.35,
};

export const THEMES: Record<TetrisSkin, Record<TetrisTheme, ThemeTokens>> = {
  retro: BASE,
  pixel: BASE,
  neon: { dark: NEON, light: NEON },
  pastel: {
    dark: { background: "#2a2838", grid: "#2b2940", ghostAlpha: 0.5 },
    light: { background: "#ffffff", grid: "#f0e4ec", ghostAlpha: 0.5 },
  },
};
