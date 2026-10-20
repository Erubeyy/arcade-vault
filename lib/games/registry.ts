// Registro de juegos con motor real. Los ids ausentes siguen con partida simulada.

import { AsteroidsEngine } from "./asteroids/engine";
import type { EngineFactory } from "./engine";

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
};

export const isRealGame = (id: string) => id in REGISTRY;
