"use client";

import type { TetrisOptions, TetrisSkin } from "@/lib/games/tetris/engine";

const SKIN_LABELS: Record<TetrisSkin, string> = {
  retro: "Retro",
  neon: "Neón",
  pastel: "Pastel",
  pixel: "Pixel art",
};

const LEVELS = Array.from({ length: 10 }, (_, i) => i + 1);

interface TetrisOptionsPanelProps {
  value: TetrisOptions;
  onChange: (next: TetrisOptions) => void;
}

export function TetrisOptionsPanel({
  value,
  onChange,
}: TetrisOptionsPanelProps) {
  const light = value.theme === "light";

  return (
    <div
      className="tetris-options"
      role="group"
      aria-label="Opciones de Tetris"
    >
      <label>
        <span>Skin</span>
        <select
          value={value.skin}
          onChange={(e) => {
            onChange({ ...value, skin: e.target.value as TetrisSkin });
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

      <button
        type="button"
        role="switch"
        aria-checked={light}
        onClick={(e) => {
          onChange({ ...value, theme: light ? "dark" : "light" });
          e.currentTarget.blur(); // si no, ESPACIO volvería a pulsar el botón
        }}
      >
        Tablero {light ? "claro" : "oscuro"}
      </button>

      <label>
        <span>Nivel inicial</span>
        <select
          value={value.startLevel}
          onChange={(e) => {
            onChange({ ...value, startLevel: Number(e.target.value) });
            e.currentTarget.blur();
          }}
        >
          {LEVELS.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <small>desde la próxima partida</small>
      </label>
    </div>
  );
}
