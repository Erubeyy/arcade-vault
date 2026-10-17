"use server";

import { revalidateTag } from "next/cache";

// Invalida las lecturas cacheadas tras guardar una marca: el leaderboard del juego y
// las estadísticas (best/plays) del catálogo. expire: 0 evita servir datos obsoletos.
export async function revalidateScores(gameId: string) {
  if (typeof gameId !== "string" || gameId.length === 0 || gameId.length > 64) return;
  revalidateTag(`scores-${gameId}`, { expire: 0 });
  revalidateTag("games", { expire: 0 });
}
