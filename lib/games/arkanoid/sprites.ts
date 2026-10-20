// Sprites de Arkanoid portados de references/started-games/04-arkanoid/assets/spritesheet.js.
// Sin globals: la imagen se recibe como argumento y se carga bajo demanda.

import type { BlockColor } from "./levels";

export interface Frame {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

export const SPRITESHEET_SRC = "/games/bloque-buster/spritesheet-breakout.png";
export const EXPLOSION_DURATION = 150; // ms

// 4 fotogramas por color; `gray` reutiliza los del rojo.
const explosion = (sy: number): Frame[] =>
  [256, 288, 320, 352].map((sx) => ({ sx, sy, sw: 32, sh: 16 }));

export const EXPLOSION_FRAMES: Record<BlockColor, Frame[]> = {
  red: explosion(176),
  cyan: explosion(192),
  green: explosion(208),
  magenta: explosion(224),
  yellow: explosion(240),
  hotpink: explosion(256),
  gray: explosion(176),
};

export const PADDLE_SPRITE: Frame = { sx: 32, sy: 112, sw: 162, sh: 14 };
export const BALL_SPRITE: Frame = { sx: 32, sy: 32, sw: 16, sh: 16 };

export const BLOCK_SPRITES: Record<BlockColor, Frame> = {
  gray: { sx: 32, sy: 288, sw: 32, sh: 16 },
  red: { sx: 32, sy: 176, sw: 32, sh: 16 },
  yellow: { sx: 32, sy: 240, sw: 32, sh: 16 },
  cyan: { sx: 32, sy: 192, sw: 32, sh: 16 },
  magenta: { sx: 32, sy: 224, sw: 32, sh: 16 },
  hotpink: { sx: 32, sy: 256, sw: 32, sh: 16 },
  green: { sx: 32, sy: 208, sw: 32, sh: 16 },
};

// Solo se llama desde el cliente (dentro de `start()` del motor).
export function loadSpritesheet(
  src = SPRITESHEET_SRC,
): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("No se pudo cargar el spritesheet"));
    img.src = src;
  });
}

export function drawFrame(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  frame: Frame,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  ctx.drawImage(img, frame.sx, frame.sy, frame.sw, frame.sh, x, y, w, h);
}
