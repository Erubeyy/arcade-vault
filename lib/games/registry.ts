// Registro de juegos con motor real. Los ids ausentes siguen con partida simulada.

import { AsteroidsEngine, type AsteroidsOptions } from "./asteroids/engine";
import type { EngineFactory, VirtualButton } from "./engine";
import { ArkanoidEngine, type ArkanoidOptions } from "./arkanoid/engine";
import {
  FroggerEngine,
  W as FROGGER_W,
  H as FROGGER_H,
  type FroggerOptions,
} from "./frogger/engine";
import {
  SnakeEngine,
  W as SNAKE_W,
  H as SNAKE_H,
  type SnakeOptions,
} from "./snake/engine";
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
  pad: Partial<Record<VirtualButton, string>>; // botón usado → etiqueta accesible; los ausentes se desactivan
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
    pad: {
      left: "Rotar a la izquierda",
      right: "Rotar a la derecha",
      up: "Propulsar",
      a: "Disparar",
    },
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
    pad: {
      left: "Mover a la izquierda",
      right: "Mover a la derecha",
      up: "Rotar",
      down: "Bajar",
      a: "Rotar",
      b: "Caída",
    },
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
    pad: {
      left: "Mover a la izquierda",
      right: "Mover a la derecha",
      a: "Lanzar la bola",
    },
  },
  // Snake reemplaza al placeholder `serpentina` del catálogo (SPEC 09): el id no cambia.
  serpentina: {
    create: (canvas, cb, options) =>
      new SnakeEngine(canvas, cb, options as Partial<SnakeOptions> | undefined),
    width: SNAKE_W,
    height: SNAKE_H,
    controls: [
      { keys: ["←", "↑", "→", "↓"], label: "mover" },
      { keys: ["W", "A", "S", "D"], label: "mover" },
    ],
    pad: {
      up: "Arriba",
      down: "Abajo",
      left: "Izquierda",
      right: "Derecha",
    },
  },
  // Frogger reemplaza al placeholder `ranaria` del catálogo (SPEC 11): el id no cambia.
  ranaria: {
    create: (canvas, cb, options) =>
      new FroggerEngine(
        canvas,
        cb,
        options as Partial<FroggerOptions> | undefined,
      ),
    width: FROGGER_W,
    height: FROGGER_H,
    controls: [
      { keys: ["←", "↑", "→", "↓"], label: "saltar" },
      { keys: ["W", "A", "S", "D"], label: "saltar" },
    ],
    pad: {
      up: "Saltar arriba",
      down: "Saltar abajo",
      left: "Saltar a la izquierda",
      right: "Saltar a la derecha",
    },
  },
};

export const isRealGame = (id: string) => id in REGISTRY;
