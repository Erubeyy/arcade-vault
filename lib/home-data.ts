import type { GameColor } from "@/lib/games";

export interface Feature {
  icon: "GAMEPAD" | "FREE" | "TROPHY" | "ROCKET";
  title: string;
  desc: string;
  color: GameColor;
}

export interface RecentScore {
  player: string;
  game: string;
  score: number;
  when: string;
  color: GameColor;
}

export interface TopPlayer {
  rank: number;
  player: string;
  score: number;
}

export interface Stat {
  n: string;
  u: string;
  s: string;
}

export const FEATURES: Feature[] = [
  { icon: "GAMEPAD", title: "JUEGOS CLÁSICOS", desc: "Arkanoid, Tetris, Snake y muchos más. Los mejores arcades de todos los tiempos en un solo lugar.", color: "cyan" },
  { icon: "FREE", title: "100% GRATIS", desc: "Sin suscripciones, sin pagos ocultos. Todos los juegos disponibles de forma gratuita.", color: "yellow" },
  { icon: "TROPHY", title: "LADDER BOARDS", desc: "Compite con jugadores de todo el mundo. Escala el ranking y demuestra quién es el mejor.", color: "magenta" },
  { icon: "ROCKET", title: "SIEMPRE CRECIENDO", desc: "Agregamos nuevos juegos constantemente. Vuelve seguido, siempre habrá algo nuevo que jugar.", color: "green" },
];

export const STATS: Stat[] = [
  { n: "12+", u: "JUEGOS", s: "Y CONTANDO" },
  { n: "MILES", u: "DE PARTIDAS", s: "JUGADAS CADA DÍA" },
  { n: "GLOBAL", u: "RANKING", s: "COMPITE CON EL MUNDO" },
];

export const RECENT_SCORES: RecentScore[] = [
  { player: "NEONFOX", game: "Caída", score: 184220, when: "hace 2 min", color: "magenta" },
  { player: "PX_KAI", game: "Glotón", score: 96400, when: "hace 5 min", color: "yellow" },
  { player: "Z3R0COOL", game: "Invasores", score: 54190, when: "hace 8 min", color: "green" },
  { player: "VAULT_07", game: "Rocas", score: 41200, when: "hace 12 min", color: "cyan" },
  { player: "GLITCHA", game: "Bloque Buster", score: 28450, when: "hace 18 min", color: "cyan" },
  { player: "ARKADYA", game: "Serpentina", score: 7820, when: "hace 24 min", color: "green" },
  { player: "CYBER_LU", game: "Ranaria", score: 18900, when: "hace 31 min", color: "yellow" },
];

export const TOP_PLAYERS: TopPlayer[] = [
  { rank: 1, player: "NEONFOX", score: 312840 },
  { rank: 2, player: "PX_KAI", score: 248110 },
  { rank: 3, player: "M00NRYU", score: 196720 },
  { rank: 4, player: "VAULT_07", score: 154300 },
  { rank: 5, player: "GLITCHA", score: 138900 },
];
