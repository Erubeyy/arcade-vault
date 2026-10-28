"use server";

import { revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Invalida las lecturas cacheadas tras guardar una marca: el leaderboard del juego y
// las estadísticas (best/plays) del catálogo. expire: 0 evita servir datos obsoletos.
// Solo con sesión (guardar una marca ya la exige) y con un id de juego con forma válida.
export async function revalidateScores(gameId: string) {
  if (typeof gameId !== "string" || !/^[a-z0-9-]{1,64}$/.test(gameId)) return;

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) return;

  revalidateTag(`scores-${gameId}`, { expire: 0 });
  revalidateTag("games", { expire: 0 });
}
