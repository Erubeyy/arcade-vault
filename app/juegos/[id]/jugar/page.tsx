import { Suspense } from "react";
import { notFound } from "next/navigation";
import { GamePlayer } from "@/components/game-player";
import { getGame, getGames } from "@/lib/games";

type Params = PageProps<"/juegos/[id]/jugar">["params"];

export async function generateStaticParams() {
  return (await getGames()).map((g) => ({ id: g.id }));
}

export default function PlayPage(props: PageProps<"/juegos/[id]/jugar">) {
  return (
    <Suspense fallback={<PlayerFallback />}>
      <Player params={props.params} />
    </Suspense>
  );
}

async function Player({ params }: { params: Params }) {
  const { id } = await params;
  const game = await getGame(id);
  if (!game) notFound();

  return <GamePlayer gameId={game.id} title={game.title} />;
}

function PlayerFallback() {
  return (
    <div className="pixel neon-cyan" style={{ textAlign: "center", padding: 80, fontSize: 12 }}>
      CARGANDO <span className="blink">_</span>
    </div>
  );
}
