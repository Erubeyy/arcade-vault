"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Game } from "@/lib/games";
import { queryTopScores, type ScoreRow } from "@/lib/scores-query";
import { useSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/client";

const fmt = (n: number) => n.toLocaleString("es-ES");
const top = (i: number) => (i === 0 ? " top1" : i === 1 ? " top2" : i === 2 ? " top3" : "");
const fmtDate = (ms: number) => {
  const d = new Date(ms);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
};

type Mine = { key: string; score: number; at: number } | null;

type Result = { tab: string; rows: ScoreRow[]; failed: boolean };

function PodiumSlot({ cls, num, row, big }: { cls: string; num: string; row?: ScoreRow; big?: boolean }) {
  return (
    <div className={"podium-slot " + cls}>
      {big && (
        <div className="pixel" style={{ fontSize: 9, color: "var(--gold)", letterSpacing: "0.18em" }}>CAMPEÓN</div>
      )}
      <div className="rank-num" style={big ? { fontSize: 36, marginTop: 4 } : undefined}>{num}</div>
      <div className="name">{row ? row.name : "—"}</div>
      <div className="score" style={big ? { fontSize: 20 } : undefined}>{row ? fmt(row.score) : "—"}</div>
      <div className="date">{row ? row.date : "SIN MARCA"}</div>
    </div>
  );
}

export function HallOfFame({ games }: { games: Game[] }) {
  const { user, status } = useSession();
  const [tab, setTab] = useState(games[0].id);
  const [result, setResult] = useState<Result | null>(null);
  const [supabase] = useState(() => createClient());
  const game = games.find((g) => g.id === tab) ?? games[0];

  useEffect(() => {
    let cancelled = false;
    queryTopScores(supabase, tab, 10)
      .then((rows) => !cancelled && setResult({ tab, rows, failed: false }))
      .catch(() => !cancelled && setResult({ tab, rows: [], failed: true }));
    return () => {
      cancelled = true;
    };
  }, [supabase, tab]);

  const loading = result?.tab !== tab;
  const rows = loading || !result ? [] : result.rows;
  const failed = !loading && !!result?.failed;

  // Mejor marca del usuario: consulta a Supabase por game_id y name = username.
  const username = status === "ready" ? (user?.username ?? null) : null;
  const [mineResult, setMineResult] = useState<Mine>(null);

  useEffect(() => {
    if (!username) return;
    let cancelled = false;
    supabase
      .from("scores")
      .select("score, created_at")
      .eq("game_id", tab)
      .eq("name", username)
      .order("score", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        setMineResult(
          data
            ? {
                key: `${tab}:${username}`,
                score: data.score,
                at: Date.parse(data.created_at),
              }
            : null,
        );
      });
    return () => {
      cancelled = true;
    };
  }, [supabase, tab, username]);

  const mine =
    username && mineResult?.key === `${tab}:${username}` ? mineResult : null;

  return (
    <div className="av-hall fade-in">
      <div className="hall-head">
        <h1>SALÓN DE LA FAMA</h1>
        <p className="pixel" style={{ fontSize: 10 }}>LOS NOMBRES QUE NUNCA SE BORRAN DE LA PANTALLA</p>
      </div>

      <div className="hall-tabs">
        {games.map((g) => (
          <button key={g.id} className={"chip" + (tab === g.id ? " active" : "")} onClick={() => setTab(g.id)}>
            {g.title}
          </button>
        ))}
      </div>

      <div className="podium">
        <PodiumSlot cls="silver" num="02" row={rows[1]} />
        <PodiumSlot cls="gold" num="01" row={rows[0]} big />
        <PodiumSlot cls="bronze" num="03" row={rows[2]} />
      </div>

      <div className="hall-table">
        <div className="th">
          <div>RANGO</div>
          <div>JUGADOR</div>
          <div>PUNTUACIÓN</div>
          <div>FECHA</div>
        </div>
        {loading && (
          <div className="tr" style={{ justifyContent: "center" }}>
            <span className="pixel neon-cyan" style={{ fontSize: 11 }}>
              CARGANDO <span className="blink">_</span>
            </span>
          </div>
        )}
        {failed && (
          <div className="tr" style={{ display: "block", textAlign: "center", color: "var(--magenta)" }}>
            No se pudieron cargar las marcas. Cambia de pestaña o recarga la página para reintentar.
          </div>
        )}
        {!loading && !failed && rows.length === 0 && (
          <div className="tr" style={{ display: "block", textAlign: "center", padding: "28px 12px", color: "var(--ink-faint)" }}>
            <div className="pixel" style={{ fontSize: 12, color: "var(--magenta)", marginBottom: 8 }}>SIN MARCAS</div>
            Nadie ha guardado una puntuación en {game.title} todavía.
          </div>
        )}
        {rows.map((r, i) => (
          <div key={r.rank} className={"tr" + top(i)} style={{ animationDelay: `${i * 50}ms` }}>
            <div className="rk">#{String(r.rank).padStart(2, "0")}</div>
            <div className="pl">{r.name}</div>
            <div className="sc">{fmt(r.score)}</div>
            <div className="dt">{r.date}</div>
          </div>
        ))}
        {username && mine && (
          <>
            <div className="tr you-label">▸ TU MEJOR MARCA EN {game.title}</div>
            <div className="tr you">
              <div className="rk" style={{ color: "var(--yellow)" }}>—</div>
              <div className="pl" style={{ color: "var(--yellow)" }}>{username}</div>
              <div className="sc" style={{ color: "var(--yellow)", textShadow: "0 0 6px rgba(245,255,0,0.5)" }}>
                {fmt(mine.score)}
              </div>
              <div className="dt">{fmtDate(mine.at)}</div>
            </div>
          </>
        )}
      </div>

      <div style={{ textAlign: "center", marginTop: 32 }}>
        <Link className="btn lg" href="/biblioteca">VOLVER A LA BIBLIOTECA</Link>
      </div>
    </div>
  );
}
