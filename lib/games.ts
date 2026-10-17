import { cacheTag } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";
import type { Database } from "@/lib/supabase/database.types";

export type Category = "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS";
export type GameColor = "cyan" | "magenta" | "yellow" | "green";

export interface Game {
  id: string;
  title: string;
  short: string;
  long: string;
  cat: Category;
  cover: string;
  color: GameColor;
  best: number; // MAX(score), 0 si no hay marcas
  plays: number; // COUNT(*) de scores
}

export { CATS } from "@/lib/categories";

type GameRow = Database["public"]["Views"]["games_with_stats"]["Row"];

// La vista tipa todas las columnas como nullable; las restricciones de la tabla garantizan que no lo son.
function toGame(row: GameRow): Game {
  return {
    id: row.id!,
    title: row.title!,
    short: row.short!,
    long: row.long!,
    cat: row.cat as Category,
    cover: row.cover!,
    color: row.color as GameColor,
    best: row.best ?? 0,
    plays: row.plays ?? 0,
  };
}

export async function getGames(): Promise<Game[]> {
  "use cache";
  cacheTag("games");

  const { data, error } = await createPublicClient()
    .from("games_with_stats")
    .select("*")
    .order("position");
  if (error) throw error;
  return data.map(toGame);
}

export async function getGame(id: string): Promise<Game | null> {
  "use cache";
  cacheTag("games");

  const { data, error } = await createPublicClient()
    .from("games_with_stats")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? toGame(data) : null;
}
