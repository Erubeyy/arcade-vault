# Sugerencias de juegos

Juegos sugeridos por el agente `game-planner` para Arcade Vault, según su estado.

Flujo: **pendiente de decisión** → `/new-game <id>` (spec en `specs/NN-slug.md`) → **aceptado / en desarrollo** (`/spec-impl`, rama `spec-NN-slug`) → **implementado** (PR mergeado).

Última actualización: 2026-10-20.

- **Total:** puntuación del `game-planner` sobre 30.
- **Id destino:** `id` en `games` (Supabase). Si es un placeholder existente se conserva el id; los marcados _nuevo_ no existen aún en la BD.
- Los candidatos que comparten id destino (`rocas`, `duelo-pixel`, `ranaria`) son alternativas entre sí: solo se implementa uno por placeholder.
- Ninguno tiene referencia en `references/started-games/`.

## 1. Pendientes de decisión

| #   | Juego                      | Total | Id destino         | Cat.              | Color         | Controles                   | Riesgo principal                           |
| --- | -------------------------- | ----- | ------------------ | ----------------- | ------------- | --------------------------- | ------------------------------------------ |
| 1   | Pong vs CPU                | 25    | `duelo-pixel`      | VERSUS            | cyan          | ↑/↓, W/S                    | Calibrar la IA                             |
| 2   | Invasores (Space Invaders) | 24    | `invasores`        | SHOOTER           | green         | ←/→, ESPACIO                | Ritmo de la formación                      |
| 2   | Missile Command            | 24    | `rocas`            | SHOOTER           | yellow        | Ratón / teclado             | Primer juego con ratón                     |
| 4   | Glotón (Pac-Man)           | 23    | `gloton`           | ARCADE            | yellow        | Flechas, WASD               | IA de fantasmas y mapa                     |
| 4   | Fusión (2048)              | 23    | `rocas`            | PUZZLE            | yellow        | Flechas, WASD               | Clon muy conocido                          |
| 4   | Neon Dash (runner)         | 23    | `rocas`            | ARCADE            | yellow        | ESPACIO/↑, ↓                | Obstáculos imposibles al azar              |
| 7   | Gemas Neón (match-3)       | 22    | `duelo-pixel`      | PUZZLE            | magenta       | Ratón / flechas             | Ratón y cascadas                           |
| 7   | Eco (Simon)                | 22    | `eco` (nuevo)      | PUZZLE            | green         | Flechas, Q/W/A/S            | Necesita audio                             |
| 9   | Robotron (Arena)           | 21    | `arena` (nuevo)    | SHOOTER           | magenta       | WASD + flechas              | Rendimiento con muchas entidades           |
| 9   | Ranaria sin fin            | 21    | `ranaria`          | ARCADE            | green         | Flechas, WASD               | Tercer ARCADE, repite verde                |
| 9   | Turbo Neón (carreras)      | 21    | _nuevo_            | ARCADE o CARRERAS | magenta       | ←/→, ↑/↓                    | CARRERAS exige migración                   |
| 12  | Duelo de tanques vs CPU    | 20    | `duelo-pixel`      | SHOOTER o VERSUS  | cyan          | Flechas, ESPACIO            | IA de la CPU                               |
| 12  | Ranaria (Frogger)          | 20    | `ranaria`          | ARCADE            | green         | Flechas, WASD               | Colisiones en el río                       |
| 12  | Tron vs CPU                | 20    | `duelo-pixel`      | VERSUS            | cyan          | Flechas, WASD, ESPACIO      | IA de evasión                              |
| 15  | Centipede (Ciempiés)       | 19    | `ciempies` (nuevo) | SHOOTER           | green/magenta | Flechas/WASD, ESPACIO       | Partir el ciempiés en cadenas              |
| 15  | Boulder Dash               | 19    | `rocas`            | ARCADE            | yellow        | Flechas, WASD, ESPACIO      | Simulación de caída y cuevas               |
| 15  | Flujo (Pipe Mania)         | 19    | `flujo` (nuevo)    | PUZZLE            | cyan          | Flechas, ESPACIO, X         | Equilibrar la velocidad del fluido         |
| 15  | Jonrón (bateo)             | 19    | _nuevo_            | DEPORTES          | yellow        | ←/→, ESPACIO                | No encaja con la estética; categoría nueva |
| 19  | Galaga (Galaxia)           | 18    | `galaxia` (nuevo)  | SHOOTER           | magenta       | ←/→, ESPACIO                | Se parece a Invasores                      |
| 19  | Minado (Minesweeper)       | 18    | `minado` (nuevo)   | PUZZLE            | yellow        | Ratón / flechas, ESPACIO, F | 50/50 injustos para un leaderboard         |
| 21  | Barriles (Donkey Kong)     | 16    | `barriles` (nuevo) | ARCADE            | magenta       | Flechas/AD, W/S, ESPACIO    | El más complejo (física y vigas)           |

## 2. Aceptados / en desarrollo

| Juego               | Id destino | Spec | Rama | Estado |
| ------------------- | ---------- | ---- | ---- | ------ |
| _(ninguno todavía)_ |            |      |      |        |

## 3. Implementados

| Spec | Juego     | Id              | Cat.    | Color   |
| ---- | --------- | --------------- | ------- | ------- |
| 05   | Asteroids | `asteroids`     | SHOOTER | cyan    |
| 07   | Tetris    | `caida`         | PUZZLE  | magenta |
| 08   | Arkanoid  | `bloque-buster` | ARCADE  | cyan    |
| 09   | Snake     | `serpentina`    | ARCADE  | green   |

## 4. Descartados

| Juego               | Motivo |
| ------------------- | ------ |
| _(ninguno todavía)_ |        |

## Limitaciones del catálogo

- Categorías cerradas: ARCADE, PUZZLE, SHOOTER y VERSUS. Añadir otras (CARRERAS, DEPORTES) exige migración y tocar `lib/games.ts` y `lib/categories.ts`.
- Colores cerrados: cyan, magenta, yellow y green.
- `rocas` comparte `cover-rocas` con Asteroids; reconvertirlo pide una cover nueva.
- Reconvertir `duelo-pixel` en un juego contra la CPU cambia su concepto original.
