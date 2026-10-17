import { cacheTag } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";
import { queryTopScores, type ScoreRow } from "@/lib/scores-query";

export type { ScoreRow };

// Lectura de servidor (cacheada). Desde el navegador usar queryTopScores con lib/supabase/client.ts.
export async function getTopScores(gameId: string, limit = 10): Promise<ScoreRow[]> {
  "use cache";
  cacheTag(`scores-${gameId}`);

  return queryTopScores(createPublicClient(), gameId, limit);
}
