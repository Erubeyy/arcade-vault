import type { Metadata } from "next";
import { HallOfFame } from "@/components/hall-of-fame";
import { getGames } from "@/lib/games";

export const metadata: Metadata = {
  title: "Salón de la Fama · Arcade Vault",
};

export default async function SalonPage() {
  return <HallOfFame games={await getGames()} />;
}
