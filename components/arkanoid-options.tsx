"use client";

import type { ArkanoidOptions } from "@/lib/games/arkanoid/engine";

interface ArkanoidOptionsPanelProps {
  value: ArkanoidOptions;
  onChange: (next: ArkanoidOptions) => void;
}

// Segunda fila de la barra `.player-hud`: misma etiqueta (`.l`) y mismo botón
// `hud-toggle` que el panel de opciones de Tetris.
export function ArkanoidOptionsPanel({
  value,
  onChange,
}: ArkanoidOptionsPanelProps) {
  const on = !value.muted;

  return (
    <div className="hud-options" role="group" aria-label="Opciones de Arkanoid">
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
