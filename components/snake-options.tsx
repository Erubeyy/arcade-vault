"use client";

import type { SnakeOptions, SnakeSkin } from "@/lib/games/snake/engine";

const SKIN_LABELS: Record<SnakeSkin, string> = {
  classic: "Clásico",
  neon: "Neón",
  retro: "Retro",
};

interface SnakeOptionsPanelProps {
  value: SnakeOptions;
  onChange: (next: SnakeOptions) => void;
}

// Segunda fila de la barra `.player-hud`: mismo selector de skin y mismo
// conmutador de tema que el panel de opciones de Tetris.
export function SnakeOptionsPanel({ value, onChange }: SnakeOptionsPanelProps) {
  const light = value.theme === "light";

  return (
    <div className="hud-options" role="group" aria-label="Opciones de Snake">
      <label className="hud-stat">
        <span className="l">Skin</span>
        <select
          className="hud-select"
          value={value.skin}
          onChange={(e) => {
            onChange({ ...value, skin: e.target.value as SnakeSkin });
            e.currentTarget.blur(); // devuelve el teclado al juego
          }}
        >
          {Object.entries(SKIN_LABELS).map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
      </label>

      <div className="hud-stat">
        <span className="l">Tema del tablero</span>
        <button
          type="button"
          role="switch"
          aria-checked={light}
          className="btn magenta hud-toggle"
          onClick={(e) => {
            onChange({ ...value, theme: light ? "dark" : "light" });
            e.currentTarget.blur(); // si no, ESPACIO volvería a pulsar el botón
          }}
        >
          {light ? "CLARO" : "OSCURO"}
        </button>
      </div>
    </div>
  );
}
