"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { GameCanvas, type GameCanvasHandle } from "@/components/game-canvas";
import type { GameStats } from "@/lib/games/engine";
import { REGISTRY, isRealGame } from "@/lib/games/registry";
import { TetrisEngine, type TetrisOptions } from "@/lib/games/tetris/engine";
import { DEFAULT_PREFS, loadPrefs, savePrefs } from "@/lib/games/tetris/prefs";
import { TetrisOptionsPanel } from "@/components/tetris-options";
import { useSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/client";
import { revalidateScores } from "@/app/juegos/[id]/jugar/actions";

const fmt = (n: number) => n.toLocaleString("es-ES");

type SaveState = "idle" | "saving" | "saved" | "error";

export function GamePlayer({
  gameId,
  title,
}: {
  gameId: string;
  title: string;
}) {
  const { user, saveScore } = useSession();
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState<number | undefined>(3);
  const [paused, setPaused] = useState(false);
  const [over, setOver] = useState(false);
  const [typedName, setTypedName] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const localSaved = useRef(false); // evita duplicar la copia local en av_scores al reintentar
  const [engineLevel, setEngineLevel] = useState(1);
  const canvasRef = useRef<GameCanvasHandle>(null);
  const isReal = isRealGame(gameId);
  const isTetris = gameId === "caida";
  // Las preferencias salen de localStorage, que el servidor no tiene: el panel y el
  // motor solo se montan tras la hidratación (`mounted`) para no desajustarla.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const [tetrisPrefs, setTetrisPrefs] = useState<TetrisOptions>(() =>
    isTetris ? loadPrefs() : DEFAULT_PREFS,
  );

  const name = typedName ?? user?.name ?? "INVITADO";
  const level = isReal ? engineLevel : 1 + Math.floor(score / 2500);

  useEffect(() => {
    if (isReal || over || paused) return;
    const t = setInterval(
      () => setScore((s) => s + Math.floor(10 + Math.random() * 90)),
      220,
    );
    return () => clearInterval(t);
  }, [isReal, over, paused]);

  const handleTetrisPrefs = (next: TetrisOptions) => {
    setTetrisPrefs(next);
    savePrefs(next);
    const engine = canvasRef.current?.engine();
    if (engine instanceof TetrisEngine) {
      engine.setSkin(next.skin);
      engine.setTheme(next.theme);
      engine.setStartLevel(next.startLevel);
    }
  };

  const handleStats = ({ score, lives, level }: GameStats) => {
    setScore(score);
    setLives(lives);
    setEngineLevel(level);
  };

  const handleGameOver = (finalScore: number) => {
    setScore(finalScore);
    setOver(true);
  };

  const togglePause = () => {
    if (isReal) {
      if (paused) canvasRef.current?.resume();
      else canvasRef.current?.pause();
    }
    setPaused((p) => !p);
  };

  const finish = () => {
    if (isReal) canvasRef.current?.end();
    else setOver(true);
  };

  const restart = () => {
    if (isReal) canvasRef.current?.restart();
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
    if (!isReal) {
      setSaveState("saved");
      return;
    }
    setSaveState("saving");
    const { error } = await createClient()
      .from("scores")
      .insert({
        game_id: gameId,
        name: name.trim().toUpperCase().slice(0, 10),
        score,
      });
    if (error) {
      setSaveState("error");
      return;
    }
    setSaveState("saved");
    // Si falla la revalidación la marca ya está guardada; las páginas se refrescan solas al caducar la caché.
    revalidateScores(gameId).catch(() => {});
  };

  return (
    <div className="av-player fade-in">
      <div className="player-hud">
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          <div className="hud-stat">
            <div className="l">Jugador</div>
            <div className="v" style={{ color: "var(--ink)" }}>
              {name}
            </div>
          </div>
          <div className="hud-stat">
            <div className="l">Puntuación</div>
            <div className="v">{fmt(score)}</div>
          </div>
          <div className="hud-stat lives">
            <div className="l">Vidas</div>
            <div className="v">
              {lives === undefined ? "—" : "♥ ".repeat(lives).trim() || "—"}
            </div>
          </div>
          <div className="hud-stat level">
            <div className="l">Nivel</div>
            <div className="v">{String(level).padStart(2, "0")}</div>
          </div>
        </div>
        <div className="hud-actions">
          <button className="btn yellow" onClick={togglePause}>
            {paused ? "REANUDAR" : "PAUSA"}
          </button>
          <button className="btn magenta" onClick={finish}>
            FIN
          </button>
          <Link className="btn ghost" href={`/juegos/${gameId}`}>
            SALIR
          </Link>
        </div>
        {isTetris && mounted && (
          <TetrisOptionsPanel
            value={tetrisPrefs}
            onChange={handleTetrisPrefs}
          />
        )}
      </div>

      <div className="crt">
        <div className="crt-screen">
          {isReal ? (
            (!isTetris || mounted) && (
              <GameCanvas
                ref={canvasRef}
                gameId={gameId}
                options={isTetris ? tetrisPrefs : undefined}
                onStats={handleStats}
                onGameOver={handleGameOver}
              />
            )
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
            <div
              className="crt-content"
              style={{ background: "rgba(0,0,0,0.6)", zIndex: 5 }}
            >
              <div>
                <div className="pixel neon-yellow" style={{ fontSize: 22 }}>
                  EN PAUSA
                </div>
                <div
                  className="mono"
                  style={{
                    fontSize: 11,
                    color: "var(--ink-dim)",
                    marginTop: 10,
                    letterSpacing: "0.16em",
                  }}
                >
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

      {isReal && (
        <ul className="controls-hint" aria-label="Controles">
          {REGISTRY[gameId].controls.map(({ keys, label }) => (
            <li key={`${label}-${keys.join("")}`}>
              {keys.map((k) => (
                <kbd key={k} className={k.length > 2 ? "wide" : undefined}>
                  {k}
                </kbd>
              ))}{" "}
              {label}
            </li>
          ))}
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
                  onChange={(e) =>
                    setTypedName(e.target.value.toUpperCase().slice(0, 10))
                  }
                  placeholder="TUS INICIALES"
                />
                <button
                  className="btn yellow"
                  onClick={handleSave}
                  disabled={saveState === "saving"}
                >
                  {saveState === "saving"
                    ? "GUARDANDO…"
                    : saveState === "error"
                      ? "REINTENTAR"
                      : "GUARDAR PUNTUACIÓN"}
                </button>
              </div>
            ) : (
              <div className="toast-saved">▸ PUNTUACIÓN GUARDADA_</div>
            )}
            {saveState === "error" && (
              <div
                role="alert"
                style={{ color: "var(--magenta)", fontSize: 12, marginTop: 10 }}
              >
                No se pudo guardar en el ranking. Tu marca sigue en este
                dispositivo; revisa tu conexión y reintenta.
              </div>
            )}
            <div className="actions">
              <button className="btn" onClick={restart}>
                JUGAR DE NUEVO
              </button>
              <Link className="btn magenta" href="/biblioteca">
                VOLVER AL VAULT
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
