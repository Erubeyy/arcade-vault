// Frutas de Snake portadas de references/source-assets/snake-assets/sprites.js.
// Sin globals: la imagen se recibe como argumento y se carga bajo demanda.
// Hoja de 3790×442 px con fondo transparente; solo se usa la fila y = 136–295.

export interface SpriteRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const FRUITS_SRC = "/games/serpentina/fruits.png";

export const FRUITS = {
  banana: { x: 34, y: 136, w: 110, h: 160 },
  orange: { x: 186, y: 136, w: 150, h: 160 },
  grape: { x: 378, y: 136, w: 110, h: 160 },
  garlic: { x: 540, y: 136, w: 130, h: 160 },
  eggplant: { x: 712, y: 136, w: 130, h: 160 },
  strawberry: { x: 894, y: 136, w: 110, h: 160 },
  cherry: { x: 1066, y: 136, w: 110, h: 160 },
  carrot: { x: 1228, y: 136, w: 130, h: 160 },
  mushroom: { x: 1400, y: 136, w: 130, h: 160 },
  broccoli: { x: 1582, y: 136, w: 110, h: 160 },
  watermelon: { x: 1734, y: 136, w: 150, h: 160 },
  pepper: { x: 1906, y: 136, w: 150, h: 160 },
  kiwi: { x: 2068, y: 136, w: 170, h: 160 },
  lemon: { x: 2250, y: 136, w: 140, h: 160 },
  peach: { x: 2432, y: 136, w: 130, h: 160 },
  peanut: { x: 2604, y: 136, w: 130, h: 160 },
  apple: { x: 2786, y: 136, w: 110, h: 160 },
  tomato: { x: 2948, y: 136, w: 130, h: 160 },
  berries: { x: 3110, y: 136, w: 150, h: 160 },
  grapes2: { x: 3302, y: 136, w: 110, h: 160 },
  pineapple: { x: 3454, y: 136, w: 150, h: 160 },
  melon: { x: 3637, y: 136, w: 130, h: 160 },
} as const satisfies Record<string, SpriteRect>;

export type FruitName = keyof typeof FRUITS;

export const FRUIT_NAMES = Object.keys(FRUITS) as FruitName[];

// Solo se llama desde el cliente (dentro de `start()` del motor).
export function loadFruits(src = FRUITS_SRC): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () =>
      reject(new Error("No se pudo cargar el atlas de frutas"));
    img.src = src;
  });
}

// Escala por la dimensión mayor del recorte y centra el sprite en (cx, cy).
export function drawFruit(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  name: FruitName,
  cx: number,
  cy: number,
  size: number,
) {
  const s = FRUITS[name];
  const scale = size / Math.max(s.w, s.h);
  const dw = s.w * scale;
  const dh = s.h * scale;
  ctx.drawImage(img, s.x, s.y, s.w, s.h, cx - dw / 2, cy - dh / 2, dw, dh);
}
