// Preferencias de Tetris en localStorage (clave `av_tetris_prefs`).
// Solo para código cliente: cada acceso va en try/catch porque el almacenamiento
// puede estar bloqueado y los valores pueden estar corruptos.

import type { TetrisOptions } from "./engine";
import { SKIN_NAMES, THEME_NAMES } from "./skins";

export const PREFS_KEY = "av_tetris_prefs";
export const DEFAULT_PREFS: TetrisOptions = {
  skin: "retro",
  theme: "dark",
  startLevel: 1,
};

export function loadPrefs(): TetrisOptions {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return DEFAULT_PREFS;
    const data: Partial<TetrisOptions> = JSON.parse(raw);
    const { skin, theme, startLevel } = data;
    return {
      skin: SKIN_NAMES.find((s) => s === skin) ?? DEFAULT_PREFS.skin,
      theme: THEME_NAMES.find((t) => t === theme) ?? DEFAULT_PREFS.theme,
      startLevel:
        Number.isInteger(startLevel) && startLevel! >= 1 && startLevel! <= 10
          ? startLevel!
          : DEFAULT_PREFS.startLevel,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function savePrefs(prefs: TetrisOptions) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Sin almacenamiento: las preferencias duran solo esta visita.
  }
}
