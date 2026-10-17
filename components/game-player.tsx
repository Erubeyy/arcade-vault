"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AsteroidsCanvas, type AsteroidsCanvasHandle } from "@/components/asteroids-canvas";
import type { AsteroidsStats } from "@/lib/games/asteroids/engine";
import { useSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/client";

const fmt = (n: number) => n.toLocaleString("es-ES");

type SaveState = "idle" | "saving" | "saved" | "error";

export function GamePlayer({ gameId, title }: { gameId: string; title: string }) {
  const { user, saveScore } = useSession();
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [paused, setPaused] = useState(false);
  const [over, setOver] = useState(false);
  const [typedName, setTypedName] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const localSaved = useRef(false); // evita duplicar la copia local en av_scores al reintentar
  const [engineLevel, setEngineLevel] = useState(1);
  const asteroidsRef = useRef<AsteroidsCanvasHandle>(null);
  const isAsteroids = gameId === "asteroids";

  const name = typedName ?? user?.name ?? "INVITADO";
  const level = isAsteroids ? engineLevel : 1 + Math.floor(score / 2500);

  useEffect(() => {
    if (isAsteroids || over || paused) return;
    const t = setInterval(() => setScore((s) => s + Math.floor(10 + Math.random() * 90)), 220);
    return () => clearInterval(t);
  }, [isAsteroids, over, paused]);

  const handleStats = ({ score, lives, level }: AsteroidsStats) => {
    setScore(score);
    setLives(lives);
    setEngineLevel(level);
  };

  const handleGameOver = (finalScore: number) => {
    setScore(finalScore);
    setOver(true);
  };

  const togglePause = () => {
    if (isAsteroids) {
      if (paused) asteroidsRef.current?.resume();
      else asteroidsRef.current?.pause();
    }
    setPaused((p) => !p);
  };

  const finish = () => {
    if (isAsteroids) asteroidsRef.current?.end();
    else setOver(true);
  };

  const restart = () => {
    if (isAsteroids) asteroidsRef.current?.restart();
    setScore(0);
    setLives(3);
    setEngineLevel(1);
    setPaused(false);
    setOver(false);
    setSaveState("idle");
    localSaved.current = false;
  };

  const handleSave = async () => {
    if (!localSaved.current) {
      saveScore({ game: gameId, score, name });
      localSaved.current = true;
    }
    if (!isAsteroids) {
      setSaveState("saved");
      return;
    }
    setSaveState("saving");
    const { error } = await createClient()
      .from("scores")
      .insert({ game_id: gameId, name: name.trim().toUpperCase().slice(0, 10), score });
    setSaveState(error ? "error" : "saved");
  };

  return (
    <div className="av-player fade-in">
      <div className="player-hud">
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          <div className="hud-stat">
            <div className="l">Jugador</div>
            <div className="v" style={{ color: "var(--ink)" }}>{name}</div>
          </div>
          <div className="hud-stat">
            <div className="l">Puntuación</div>
            <div className="v">{fmt(score)}</div>
          </div>
          <div className="hud-stat lives">
            <div className="l">Vidas</div>
            <div className="v">{"♥ ".repeat(lives).trim() || "—"}</div>
          </div>
          <div className="hud-stat level">
            <div className="l">Nivel</div>
            <div className="v">{String(level).padStart(2, "0")}</div>
          </div>
        </div>
        <div className="hud-actions">
          <button className="btn yellow" onClick={togglePause}>{paused ? "REANUDAR" : "PAUSA"}</button>
          <button className="btn magenta" onClick={finish}>FIN</button>
          <Link className="btn ghost" href={`/juegos/${gameId}`}>SALIR</Link>
        </div>
      </div>

      <div className="crt">
        <div className="crt-screen">
          {isAsteroids ? (
            <AsteroidsCanvas
              ref={asteroidsRef}
              onStats={handleStats}
              onGameOver={handleGameOver}
            />
          ) : (
            <div className="game-arena">
              <div className="grid-floor"></div>
              <div className="enemy e1"></div>
              <div className="enemy e2"></div>
              <div className="enemy e3"></div>
              <div className="player-ship"></div>
            </div>
          )}
          {paused && (
            <div className="crt-content" style={{ background: "rgba(0,0,0,0.6)", zIndex: 5 }}>
              <div>
                <div className="pixel neon-yellow" style={{ fontSize: 22 }}>EN PAUSA</div>
                <div className="mono" style={{ fontSize: 11, color: "var(--ink-dim)", marginTop: 10, letterSpacing: "0.16em" }}>
                  PULSA REANUDAR PARA CONTINUAR
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="crt-bottom">
          <span className="led">SEÑAL OK</span>
          <span>{title} · CRT-83 · 60 HZ</span>
          <span>CARGA · 1MB</span>
        </div>
      </div>

      {isAsteroids && (
        <ul className="controls-hint" aria-label="Controles">
          <li><kbd>←</kbd><kbd>→</kbd> rotar</li>
          <li><kbd>↑</kbd> propulsar</li>
          <li><kbd className="wide">ESPACIO</kbd> disparar</li>
        </ul>
      )}

      {over && (
        <div className="modal-bd">
          <div className="modal">
            <h2>FIN DEL JUEGO</h2>
            <div className="final-label">PUNTUACIÓN FINAL</div>
            <div className="final">{fmt(score)}</div>
            {saveState !== "saved" ? (
              <div className="input-row">
                <input
                  value={name}
                  onChange={(e) => setTypedName(e.target.value.toUpperCase().slice(0, 10))}
                  placeholder="TUS INICIALES"
                />
                <button className="btn yellow" onClick={handleSave} disabled={saveState === "saving"}>
                  {saveState === "saving" ? "GUARDANDO…" : saveState === "error" ? "REINTENTAR" : "GUARDAR PUNTUACIÓN"}
                </button>
              </div>
            ) : (
              <div className="toast-saved">▸ PUNTUACIÓN GUARDADA_</div>
            )}
            {saveState === "error" && (
              <div role="alert" style={{ color: "var(--magenta)", fontSize: 12, marginTop: 10 }}>
                No se pudo guardar en el ranking. Tu marca sigue en este dispositivo; revisa tu conexión y reintenta.
              </div>
            )}
            <div className="actions">
              <button className="btn" onClick={restart}>JUGAR DE NUEVO</button>
              <Link className="btn magenta" href="/biblioteca">VOLVER AL VAULT</Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
