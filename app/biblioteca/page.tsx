import { Library } from "@/components/library";
import { getGames } from "@/lib/games";
import { isRealGame } from "@/lib/games/registry";

export default async function BibliotecaPage() {
  const games = (await getGames()).filter((g) => isRealGame(g.id));
  return <Library games={games} />;
}
