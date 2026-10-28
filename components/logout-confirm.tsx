"use client";

import { useEffect, useRef, useState } from "react";

export function LogoutConfirm({
  open,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) cancelRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onCancel]);

  if (!open) return null;

  const confirm = async () => {
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-bd" onClick={() => !busy && onCancel()}>
      <div
        className="modal logout"
        role="dialog"
        aria-modal="true"
        aria-labelledby="logout-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="logout-title">¿CERRAR SESIÓN?</h2>
        <p>Podrás seguir jugando como invitado, pero no guardarás marcas.</p>
        <div className="actions">
          <button
            ref={cancelRef}
            className="btn"
            onClick={onCancel}
            disabled={busy}
          >
            CANCELAR
          </button>
          <button className="btn danger" onClick={confirm} disabled={busy}>
            {busy ? "SALIENDO…" : "SÍ, SALIR"}
          </button>
        </div>
      </div>
    </div>
  );
}
