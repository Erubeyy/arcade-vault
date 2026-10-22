"use client";

import type {
  ArkanoidOptions,
  ArkanoidSkin,
} from "@/lib/games/arkanoid/engine";

const SKIN_LABELS: Record<ArkanoidSkin, string> = {
  classic: "Clásico",
  neon: "Neón",
  retro: "Retro",
  arcade: "Arcade",
};

interface ArkanoidOptionsPanelProps {
  value: ArkanoidOptions;
  onChange: (next: ArkanoidOptions) => void;
}

// Segunda fila de la barra `.player-hud`: mismo selector de skin, conmutador de
// tema y botón `hud-toggle` que los paneles de Tetris y Asteroids.
export function ArkanoidOptionsPanel({
  value,
  onChange,
}: ArkanoidOptionsPanelProps) {
  const on = !value.muted;
  const light = value.theme === "light";

  return (
    <div className="hud-options" role="group" aria-label="Opciones de Arkanoid">
      <label className="hud-stat">
        <span className="l">Skin</span>
        <select
          className="hud-select"
          value={value.skin}
          onChange={(e) => {
            onChange({ ...value, skin: e.target.value as ArkanoidSkin });
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

      <div className="hud-stat">
        <span className="l">Sonido</span>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          className="btn magenta hud-toggle"
          onClick={(e) => {
            onChange({ ...value, muted: on });
            e.currentTarget.blur(); // si no, ESPACIO volvería a pulsar el botón
          }}
        >
          {on ? "SONIDO" : "SILENCIO"}
        </button>
      </div>
    </div>
  );
}
