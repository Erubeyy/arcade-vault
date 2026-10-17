import { Library } from "@/components/library";
import { getGames } from "@/lib/games";

export default async function BibliotecaPage() {
  return <Library games={await getGames()} />;
}
