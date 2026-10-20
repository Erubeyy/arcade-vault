// Preferencias de Arkanoid en localStorage (clave `av_arkanoid_prefs`).
// Solo para código cliente: cada acceso va en try/catch porque el almacenamiento
// puede estar bloqueado y los valores pueden estar corruptos.

import type { ArkanoidOptions } from "./engine";

export const PREFS_KEY = "av_arkanoid_prefs";
export const DEFAULT_PREFS: ArkanoidOptions = { muted: false };

export function loadPrefs(): ArkanoidOptions {
  // En el prerenderizado del servidor no hay localStorage.
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return DEFAULT_PREFS;
    const data: Partial<ArkanoidOptions> = JSON.parse(raw);
    return {
      muted: typeof data.muted === "boolean" ? data.muted : DEFAULT_PREFS.muted,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function savePrefs(prefs: ArkanoidOptions) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Sin almacenamiento: la preferencia dura solo esta visita.
  }
}
