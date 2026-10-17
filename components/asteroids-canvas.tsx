"use client";

import { useEffect, useImperativeHandle, useRef, type Ref } from "react";
import {
  AsteroidsEngine,
  type AsteroidsStats,
} from "@/lib/games/asteroids/engine";

export interface AsteroidsCanvasHandle {
  pause: () => void;
  resume: () => void;
  restart: () => void;
  end: () => void;
}

interface AsteroidsCanvasProps {
  onStats: (stats: AsteroidsStats) => void;
  onGameOver: (finalScore: number) => void;
  ref?: Ref<AsteroidsCanvasHandle>;
}

export function AsteroidsCanvas({
  onStats,
  onGameOver,
  ref,
}: AsteroidsCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<AsteroidsEngine | null>(null);

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
    if (!canvas) return;
    const engine = new AsteroidsEngine(canvas, {
      onStats: (s) => onStatsRef.current(s),
      onGameOver: (score) => onGameOverRef.current(score),
    });
    engineRef.current = engine;
    engine.start();
    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

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

  return (
    <canvas
      ref={canvasRef}
      className="asteroids-canvas"
      width={800}
      height={600}
    />
  );
}
