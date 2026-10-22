// Registro de juegos con motor real. Los ids ausentes siguen con partida simulada.

import { AsteroidsEngine, type AsteroidsOptions } from "./asteroids/engine";
import type { EngineFactory } from "./engine";
import { ArkanoidEngine, type ArkanoidOptions } from "./arkanoid/engine";
import { SnakeEngine, W as SNAKE_W, H as SNAKE_H } from "./snake/engine";
import {
  TetrisEngine,
  W as TETRIS_W,
  H as TETRIS_H,
  type TetrisOptions,
} from "./tetris/engine";

export interface GameDefinition {
  create: EngineFactory;
  width: number;
  height: number;
  controls: { keys: string[]; label: string }[];
}

export const REGISTRY: Record<string, GameDefinition> = {
  asteroids: {
    create: (canvas, cb, options) =>
      new AsteroidsEngine(
        canvas,
        cb,
        options as Partial<AsteroidsOptions> | undefined,
      ),
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
      new TetrisEngine(
        canvas,
        cb,
        options as Partial<TetrisOptions> | undefined,
      ),
    width: TETRIS_W,
    height: TETRIS_H,
    controls: [
      { keys: ["←", "→"], label: "mover" },
      { keys: ["↑", "X"], label: "rotar" },
      { keys: ["↓"], label: "bajar" },
      { keys: ["ESPACIO"], label: "caída" },
    ],
  },
  // Arkanoid reemplaza al placeholder `bloque-buster` del catálogo (SPEC 08): el id no cambia.
  "bloque-buster": {
    create: (canvas, cb, options) =>
      new ArkanoidEngine(
        canvas,
        cb,
        options as Partial<ArkanoidOptions> | undefined,
      ),
    width: 800,
    height: 600,
    controls: [
      { keys: ["←", "→"], label: "mover" },
      { keys: ["A", "D"], label: "mover" },
      { keys: ["ESPACIO"], label: "lanzar" },
    ],
  },
  // Snake reemplaza al placeholder `serpentina` del catálogo (SPEC 09): el id no cambia.
  serpentina: {
    create: (canvas, cb) => new SnakeEngine(canvas, cb),
    width: SNAKE_W,
    height: SNAKE_H,
    controls: [
      { keys: ["←", "↑", "→", "↓"], label: "mover" },
      { keys: ["W", "A", "S", "D"], label: "mover" },
    ],
  },
};

export const isRealGame = (id: string) => id in REGISTRY;
