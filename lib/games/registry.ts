// Registro de juegos con motor real. Los ids ausentes siguen con partida simulada.

import { AsteroidsEngine } from "./asteroids/engine";
import type { EngineFactory } from "./engine";
import { TetrisEngine, W as TETRIS_W, H as TETRIS_H, type TetrisOptions } from "./tetris/engine";

export interface GameDefinition {
  create: EngineFactory;
  width: number;
  height: number;
  controls: { keys: string[]; label: string }[];
}

export const REGISTRY: Record<string, GameDefinition> = {
  asteroids: {
    create: (canvas, cb) => new AsteroidsEngine(canvas, cb),
    width: 800,
    height: 600,
    controls: [
      { keys: ["←", "→"], label: "rotar" },
      { keys: ["↑"], label: "propulsar" },
      { keys: ["ESPACIO"], label: "disparar" },
    ],
  },
  // Tetris reemplaza al placeholder `caida` del catálogo (SPEC 07): el id no cambia.
  caida: {
    create: (canvas, cb, options) =>
      new TetrisEngine(canvas, cb, options as Partial<TetrisOptions> | undefined),
    width: TETRIS_W,
    height: TETRIS_H,
    controls: [
      { keys: ["←", "→"], label: "mover" },
      { keys: ["↑", "X"], label: "rotar" },
      { keys: ["↓"], label: "bajar" },
      { keys: ["ESPACIO"], label: "caída" },
    ],
  },
};

export const isRealGame = (id: string) => id in REGISTRY;
