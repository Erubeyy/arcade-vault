import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export interface ScoreRow {
  rank: number;
  name: string;
  score: number;
  date: string; // dd/mm/yyyy
}

// UTC para que servidor y navegador formateen la misma fecha (sin desajustes de hidratación).
function formatDate(iso: string): string {
  const d = new Date(iso);
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getUTCFullYear()}`;
}

// Consulta compartida entre servidor (lib/scores.ts) y navegador (Salón de la Fama).
export async function queryTopScores(
  supabase: SupabaseClient<Database>,
  gameId: string,
  limit = 10,
): Promise<ScoreRow[]> {
  const { data, error } = await supabase
    .from("scores")
    .select("name, score, created_at")
    .eq("game_id", gameId)
    .order("score", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return data.map((r, i) => ({
    rank: i + 1,
    name: r.name,
    score: r.score,
    date: formatDate(r.created_at),
  }));
}
