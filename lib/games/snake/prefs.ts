// Preferencias de Snake en localStorage (clave `av_snake_prefs`).
// Solo para código cliente: cada acceso va en try/catch porque el almacenamiento
// puede estar bloqueado y los valores pueden estar corruptos.

import type { SnakeOptions } from "./engine";
import { SKIN_NAMES, THEME_NAMES } from "./skins";

export const PREFS_KEY = "av_snake_prefs";
export const DEFAULT_PREFS: SnakeOptions = {
  skin: "classic",
  theme: "dark",
};

export function loadPrefs(): SnakeOptions {
  // En el prerenderizado del servidor no hay localStorage.
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return DEFAULT_PREFS;
    const data: Partial<SnakeOptions> | null = JSON.parse(raw);
    return {
      skin: SKIN_NAMES.find((s) => s === data?.skin) ?? DEFAULT_PREFS.skin,
      theme: THEME_NAMES.find((t) => t === data?.theme) ?? DEFAULT_PREFS.theme,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function savePrefs(prefs: SnakeOptions) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Sin almacenamiento: las preferencias duran solo esta visita.
  }
}
