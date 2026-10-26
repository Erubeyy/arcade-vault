"use client";

import type { FroggerOptions, FroggerSkin } from "@/lib/games/frogger/engine";

const SKIN_LABELS: Record<FroggerSkin, string> = {
  classic: "Clásico",
  neon: "Neón",
  retro: "Retro",
};

interface FroggerOptionsPanelProps {
  value: FroggerOptions;
  onChange: (next: FroggerOptions) => void;
}

// Segunda fila de la barra `.player-hud`: mismo selector de skin y mismo
// conmutador de tema que los paneles de Tetris y Snake.
export function FroggerOptionsPanel({
  value,
  onChange,
}: FroggerOptionsPanelProps) {
  const light = value.theme === "light";

  return (
    <div className="hud-options" role="group" aria-label="Opciones de Frogger">
      <label className="hud-stat">
        <span className="l">Skin</span>
        <select
          className="hud-select"
          value={value.skin}
          onChange={(e) => {
            onChange({ ...value, skin: e.target.value as FroggerSkin });
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
            e.currentTarget.blur(); // si no, una flecha o ESPACIO volvería a pulsarlo
          }}
        >
          {light ? "CLARO" : "OSCURO"}
        </button>
      </div>
    </div>
  );
}
