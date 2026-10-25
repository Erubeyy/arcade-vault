"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent,
} from "react";
import type { VirtualButton } from "@/lib/games/engine";
import type { GameDefinition } from "@/lib/games/registry";

interface TouchPadProps {
  pad: GameDefinition["pad"];
  disabled: boolean; // true en pausa y con el modal abierto
  onInput: (button: VirtualButton, pressed: boolean) => void;
}

const ARROWS = [
  { button: "up", deg: 0 },
  { button: "left", deg: 270 },
  { button: "right", deg: 90 },
  { button: "down", deg: 180 },
] as const;

// Gamepad virtual único para todos los juegos (SPEC 10): cruceta + botones A y B.
// Cada botón usa eventos de puntero con captura, así que se pueden mantener varios a la vez.
// Solo se ve con `pointer: coarse` (ver `.touch-pad` en globals.css).
export function TouchPad({ pad, disabled, onInput }: TouchPadProps) {
  const [down, setDown] = useState<ReadonlySet<VirtualButton>>(new Set());
  const held = useRef(new Set<VirtualButton>());
  const onInputRef = useRef(onInput);
  useEffect(() => {
    onInputRef.current = onInput;
  });

  const release = useCallback((button: VirtualButton) => {
    if (!held.current.delete(button)) return;
    setDown(new Set(held.current));
    onInputRef.current(button, false);
  }, []);

  const press = useCallback((button: VirtualButton) => {
    if (held.current.has(button)) return;
    held.current.add(button);
    setDown(new Set(held.current));
    onInputRef.current(button, true);
  }, []);

  const releaseAll = useCallback(() => {
    for (const button of [...held.current]) release(button);
  }, [release]);

  // Al desactivar el pad (pausa, fin) o perder el foco no puede quedar ningún botón pegado.
  useEffect(() => {
    if (disabled) releaseAll();
  }, [disabled, releaseAll]);

  useEffect(() => {
    const onHidden = () => {
      if (document.visibilityState === "hidden") releaseAll();
    };
    window.addEventListener("blur", releaseAll);
    document.addEventListener("visibilitychange", onHidden);
    return () => {
      window.removeEventListener("blur", releaseAll);
      document.removeEventListener("visibilitychange", onHidden);
      releaseAll();
    };
  }, [releaseAll]);

  const bind = (button: VirtualButton) => ({
    onPointerDown: (e: PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      press(button);
    },
    onPointerUp: () => release(button),
    onPointerCancel: () => release(button),
    onLostPointerCapture: () => release(button),
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
    onMouseDown: (e: React.MouseEvent) => e.preventDefault(), // no roba el foco al juego
  });

  const props = (button: VirtualButton) => ({
    type: "button" as const,
    tabIndex: -1,
    disabled: disabled || !pad[button],
    "aria-label": pad[button],
    "aria-hidden": !pad[button] || undefined,
    "data-down": down.has(button) || undefined,
    ...bind(button),
  });

  return (
    <div className="touch-pad">
      <div className="tp-dpad" role="group" aria-label="Cruceta">
        {ARROWS.map(({ button, deg }) => (
          <button
            key={button}
            className={`tp-arm tp-${button}`}
            {...props(button)}
          >
            <svg
              viewBox="0 0 24 24"
              width="22"
              height="22"
              aria-hidden
              style={{ transform: `rotate(${deg}deg)` }}
            >
              <path d="M12 6 20 17H4z" fill="currentColor" />
            </svg>
          </button>
        ))}
        <div className="tp-hub" aria-hidden />
      </div>
      <div className="tp-actions" role="group" aria-label="Botones de acción">
        <button className="tp-act tp-b" {...props("b")}>
          B
        </button>
        <button className="tp-act tp-a" {...props("a")}>
          A
        </button>
      </div>
    </div>
  );
}
