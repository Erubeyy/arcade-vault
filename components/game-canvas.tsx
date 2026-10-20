"use client";

import { useEffect, useImperativeHandle, useRef, type Ref } from "react";
import type { GameCallbacks, GameEngine } from "@/lib/games/engine";
import { REGISTRY } from "@/lib/games/registry";

export interface GameCanvasHandle {
  pause: () => void;
  resume: () => void;
  restart: () => void;
  end: () => void;
}

interface GameCanvasProps {
  gameId: string;
  onStats: GameCallbacks["onStats"];
  onGameOver: GameCallbacks["onGameOver"];
  ref?: Ref<GameCanvasHandle>;
}

export function GameCanvas({ gameId, onStats, onGameOver, ref }: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const def = REGISTRY[gameId];

  // Los callbacks se leen desde refs para no recrear el motor si el padre
  // cambia sus funciones entre renders.
  const onStatsRef = useRef(onStats);
  const onGameOverRef = useRef(onGameOver);
  useEffect(() => {
    onStatsRef.current = onStats;
    onGameOverRef.current = onGameOver;
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !def) return;
    const engine = def.create(canvas, {
      onStats: (s) => onStatsRef.current(s),
      onGameOver: (score) => onGameOverRef.current(score),
    });
    engineRef.current = engine;
    engine.start();
    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, [def]);

  useImperativeHandle(
    ref,
    () => ({
      pause: () => engineRef.current?.pause(),
      resume: () => engineRef.current?.resume(),
      restart: () => engineRef.current?.restart(),
      end: () => engineRef.current?.end(),
    }),
    [],
  );

  if (!def) return null;
  return (
    <canvas
      ref={canvasRef}
      className="game-canvas"
      width={def.width}
      height={def.height}
    />
  );
}
