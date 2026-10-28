"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { GameCanvas, type GameCanvasHandle } from "@/components/game-canvas";
import type { GameStats } from "@/lib/games/engine";
import { REGISTRY, isRealGame } from "@/lib/games/registry";
import {
  ArkanoidEngine,
  type ArkanoidOptions,
} from "@/lib/games/arkanoid/engine";
import {
  DEFAULT_PREFS as ARKANOID_DEFAULT_PREFS,
  loadPrefs as loadArkanoidPrefs,
  savePrefs as saveArkanoidPrefs,
} from "@/lib/games/arkanoid/prefs";
import { TetrisEngine, type TetrisOptions } from "@/lib/games/tetris/engine";
import { DEFAULT_PREFS, loadPrefs, savePrefs } from "@/lib/games/tetris/prefs";
import {
  AsteroidsEngine,
  type AsteroidsOptions,
} from "@/lib/games/asteroids/engine";
import {
  DEFAULT_PREFS as ASTEROIDS_DEFAULT_PREFS,
  loadPrefs as loadAsteroidsPrefs,
  savePrefs as saveAsteroidsPrefs,
} from "@/lib/games/asteroids/prefs";
import { SnakeEngine, type SnakeOptions } from "@/lib/games/snake/engine";
import {
  DEFAULT_PREFS as SNAKE_DEFAULT_PREFS,
  loadPrefs as loadSnakePrefs,
  savePrefs as saveSnakePrefs,
} from "@/lib/games/snake/prefs";
import { FroggerEngine, type FroggerOptions } from "@/lib/games/frogger/engine";
import {
  DEFAULT_PREFS as FROGGER_DEFAULT_PREFS,
  loadPrefs as loadFroggerPrefs,
  savePrefs as saveFroggerPrefs,
} from "@/lib/games/frogger/prefs";
import { TetrisOptionsPanel } from "@/components/tetris-options";
import { AsteroidsOptionsPanel } from "@/components/asteroids-options";
import { ArkanoidOptionsPanel } from "@/components/arkanoid-options";
import { SnakeOptionsPanel } from "@/components/snake-options";
import { FroggerOptionsPanel } from "@/components/frogger-options";
import { TouchPad } from "@/components/touch-pad";
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
  const { user, status } = useSession();
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState<number | undefined>(3);
  const [paused, setPaused] = useState(false);
  const [over, setOver] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [engineLevel, setEngineLevel] = useState(1);
  const abandoned = useRef(false);
  const canvasRef = useRef<GameCanvasHandle>(null);
  const isReal = isRealGame(gameId);
  const isTetris = gameId === "caida";
  const isArkanoid = gameId === "bloque-buster";
  const isAsteroids = gameId === "asteroids";
  const isSnake = gameId === "serpentina";
  const isFrogger = gameId === "ranaria";
  const hasPrefs =
    isTetris || isArkanoid || isAsteroids || isSnake || isFrogger;
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

  const [arkanoidPrefs, setArkanoidPrefs] = useState<ArkanoidOptions>(() =>
    isArkanoid ? loadArkanoidPrefs() : ARKANOID_DEFAULT_PREFS,
  );

  const [asteroidsPrefs, setAsteroidsPrefs] = useState<AsteroidsOptions>(() =>
    isAsteroids ? loadAsteroidsPrefs() : ASTEROIDS_DEFAULT_PREFS,
  );

  const [snakePrefs, setSnakePrefs] = useState<SnakeOptions>(() =>
    isSnake ? loadSnakePrefs() : SNAKE_DEFAULT_PREFS,
  );

  const [froggerPrefs, setFroggerPrefs] = useState<FroggerOptions>(() =>
    isFrogger ? loadFroggerPrefs() : FROGGER_DEFAULT_PREFS,
  );

  const name = user?.username ?? "INVITADO";
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

  const handleArkanoidPrefs = (next: ArkanoidOptions) => {
    setArkanoidPrefs(next);
    saveArkanoidPrefs(next);
    const engine = canvasRef.current?.engine();
    if (engine instanceof ArkanoidEngine) {
      engine.setMuted(next.muted);
      engine.setSkin(next.skin);
      engine.setTheme(next.theme);
    }
  };

  const handleAsteroidsPrefs = (next: AsteroidsOptions) => {
    setAsteroidsPrefs(next);
    saveAsteroidsPrefs(next);
    const engine = canvasRef.current?.engine();
    if (engine instanceof AsteroidsEngine) {
      engine.setSkin(next.skin);
      engine.setTheme(next.theme);
    }
  };

  const handleSnakePrefs = (next: SnakeOptions) => {
    setSnakePrefs(next);
    saveSnakePrefs(next);
    const engine = canvasRef.current?.engine();
    if (engine instanceof SnakeEngine) {
      engine.setSkin(next.skin);
      engine.setTheme(next.theme);
    }
  };

  const handleFroggerPrefs = (next: FroggerOptions) => {
    setFroggerPrefs(next);
    saveFroggerPrefs(next);
    const engine = canvasRef.current?.engine();
    if (engine instanceof FroggerEngine) {
      engine.setSkin(next.skin);
      engine.setTheme(next.theme);
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
  };

  // Al volver a la página (los efectos se reejecutan al reaparecer desde la caché)
  // arranca una partida nueva en vez de dejarla en pausa.
  useEffect(() => {
    if (!abandoned.current) return;
    abandoned.current = false;
    restart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Abandona la partida sin guardar: deja todo reiniciado y en pausa, porque la
  // página puede conservarse en caché al navegar y reaparecer con el modal abierto.
  const abandon = () => {
    abandoned.current = true;
    restart();
    if (isReal) canvasRef.current?.pause();
    setPaused(true);
  };

  const handleSave = async () => {
    if (!user?.username) return; // sin perfil no se guarda (la RLS también lo rechaza)
    if (!isReal) {
      setSaveState("saved");
      return;
    }
    setSaveState("saving");
    const { error } = await createClient()
      .from("scores")
      .insert({
        game_id: gameId,
        name: user.username,
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
    <div className={`av-player fade-in${isReal ? " has-pad" : ""}`}>
      <div className="player-hud">
        <div className="hud-stats">
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
        {isArkanoid && mounted && (
          <ArkanoidOptionsPanel
            value={arkanoidPrefs}
            onChange={handleArkanoidPrefs}
          />
        )}
        {isAsteroids && mounted && (
          <AsteroidsOptionsPanel
            value={asteroidsPrefs}
            onChange={handleAsteroidsPrefs}
          />
        )}
        {isSnake && mounted && (
          <SnakeOptionsPanel value={snakePrefs} onChange={handleSnakePrefs} />
        )}
        {isFrogger && mounted && (
          <FroggerOptionsPanel
            value={froggerPrefs}
            onChange={handleFroggerPrefs}
          />
        )}
      </div>

      <div className="crt">
        <div className="crt-screen">
          {isReal ? (
            (!hasPrefs || mounted) && (
              <GameCanvas
                ref={canvasRef}
                gameId={gameId}
                options={
                  isTetris
                    ? tetrisPrefs
                    : isArkanoid
                      ? arkanoidPrefs
                      : isAsteroids
                        ? asteroidsPrefs
                        : isSnake
                          ? snakePrefs
                          : isFrogger
                            ? froggerPrefs
                            : undefined
                }
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
        <TouchPad
          pad={REGISTRY[gameId].pad}
          disabled={paused || over}
          onInput={(button, pressed) =>
            canvasRef.current?.input(button, pressed)
          }
        />
      )}

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
            {saveState === "saved" ? (
              <div className="toast-saved">▸ PUNTUACIÓN GUARDADA_</div>
            ) : status === "ready" ? (
              <div className="input-row">
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
            ) : status === "needs-profile" ? (
              <Link
                className="btn yellow"
                href="/perfil/completar"
                onClick={abandon}
              >
                COMPLETA TU PERFIL PARA GUARDAR TU MARCA
              </Link>
            ) : (
              <Link className="btn yellow" href="/login" onClick={abandon}>
                INICIA SESIÓN PARA GUARDAR TU MARCA
              </Link>
            )}
            {saveState === "error" && (
              <div
                role="alert"
                style={{ color: "var(--magenta)", fontSize: 12, marginTop: 10 }}
              >
                No se pudo guardar en el ranking. Revisa tu conexión y
                reintenta.
              </div>
            )}
            <div className="actions">
              <button className="btn" onClick={restart}>
                JUGAR DE NUEVO
              </button>
              <Link
                className="btn ghost"
                href={`/juegos/${gameId}`}
                onClick={abandon}
              >
                REGRESAR
              </Link>
              <Link
                className="btn magenta"
                href="/biblioteca"
                onClick={abandon}
              >
                VOLVER AL VAULT
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
