// Preferencias de Arkanoid en localStorage (clave `av_arkanoid_prefs`).
// Solo para código cliente: cada acceso va en try/catch porque el almacenamiento
// puede estar bloqueado y los valores pueden estar corruptos. Las preferencias
// guardadas antes de los skins (solo `muted`) siguen valiendo: skin y tema toman
// el valor por defecto.

import type { ArkanoidOptions } from "./engine";
import { SKIN_NAMES, THEME_NAMES } from "./skins";

export const PREFS_KEY = "av_arkanoid_prefs";
export const DEFAULT_PREFS: ArkanoidOptions = {
  muted: false,
  skin: "classic",
  theme: "dark",
};

export function loadPrefs(): ArkanoidOptions {
  // En el prerenderizado del servidor no hay localStorage.
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return DEFAULT_PREFS;
    const data: Partial<ArkanoidOptions> | null = JSON.parse(raw);
    return {
      muted:
        typeof data?.muted === "boolean" ? data.muted : DEFAULT_PREFS.muted,
      skin: SKIN_NAMES.find((s) => s === data?.skin) ?? DEFAULT_PREFS.skin,
      theme: THEME_NAMES.find((t) => t === data?.theme) ?? DEFAULT_PREFS.theme,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function savePrefs(prefs: ArkanoidOptions) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Sin almacenamiento: las preferencias duran solo esta visita.
  }
}
