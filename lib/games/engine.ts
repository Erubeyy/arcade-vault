// Contrato común de los motores de canvas. Sin React ni DOM global.

export interface GameStats {
  score: number;
  level: number;
  lives?: number; // omitido si el juego no tiene vidas
}

export interface GameCallbacks {
  onStats: (stats: GameStats) => void; // solo cuando cambia algún valor
  onGameOver: (finalScore: number) => void; // una vez por partida
}

export interface GameEngine {
  start(): void;
  pause(): void;
  resume(): void; // reinicia lastTime para evitar saltos
  restart(): void; // reinicia desde cero y emite onStats
  end(): void; // termina la partida y emite onGameOver (botón FIN)
  destroy(): void; // cancela rAF, quita listeners; idempotente
}

export type EngineFactory = (
  canvas: HTMLCanvasElement,
  callbacks: GameCallbacks,
  options?: unknown, // opciones propias del juego; cada motor las valida
) => GameEngine;
