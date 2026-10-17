# SPEC 06 — Tabla `games` y leaderboard real en Supabase

> **Estado:** Implementado
> **Depende de:** SPEC 04, SPEC 05
> **Fecha:** 2026-10-16
> **Objetivo:** Crear en Supabase las tablas `games` y `scores`, leer el catálogo de juegos desde `games` en toda la app y sustituir las puntuaciones sembradas del Salón de la Fama y del detalle de juego por un leaderboard real alimentado por las partidas de Asteroids.

## Por qué existe este spec

Hasta ahora el catálogo vive en `lib/games.ts` y las puntuaciones se generan con `seededScores` en `lib/scores.ts`; el SPEC 04 dejó la conexión a Supabase lista pero vacía (`list_tables` devuelve `[]`) y el SPEC 05 dejó el primer juego real, cuyas marcas hoy solo van a `localStorage` (`av_scores`). Este spec es el primer uso real de la base de datos: convierte `games` en la fuente de verdad del catálogo y `scores` en la fuente de verdad de las marcas.

No hay Supabase Auth todavía. El nombre del jugador es texto libre (el del modal de fin de partida), así que el leaderboard es falsificable por diseño. Se acepta de forma explícita y la autenticación va en otro spec.

## Alcance

**Dentro:**

- Migración `supabase/migrations/<timestamp>_games_and_scores.sql` (se crea la carpeta `supabase/` y se aplica con `apply_migration`) con las tablas `games` y `scores`, sus restricciones, índice y políticas RLS.
- Siembra de los 9 juegos actuales de `lib/games.ts` en `games` dentro de la misma migración (incluido `asteroids`).
- Tipos TypeScript generados con `generate_typescript_types` en `lib/supabase/database.types.ts`, usados por los clientes de `lib/supabase/`.
- Un cliente de solo lectura sin cookies, `lib/supabase/public.ts`, para leer datos públicos desde código cacheable (con `cacheComponents` el cliente de `server.ts` usa `cookies()` y vuelve la ruta dinámica).
- `lib/games.ts` deja de contener datos: conserva los tipos `Game`, `Category`, `GameColor`, la constante `CATS` y las funciones asíncronas `getGames()` y `getGame(id)` que consultan `games`. Con `"use cache"` y `cacheTag("games")`.
- Consumidores del catálogo que pasan a leer de `games`: `app/page.tsx` (6 primeros), `app/biblioteca/page.tsx` + `components/library.tsx` + `components/game-card.tsx`, `app/juegos/[id]/page.tsx`, `app/juegos/[id]/jugar/page.tsx` y las pestañas de `components/hall-of-fame.tsx`.
- `best` (mejor marca) y `plays` (partidas) dejan de ser datos sembrados: se derivan de `scores` con `MAX(score)` y `COUNT(*)` por juego, mediante la vista `games_with_stats`. Un juego sin marcas muestra `0` en `best` y `0` en `plays`.
- Leaderboard: top 10 por juego, todas las partidas (un mismo nombre puede repetirse), orden `score` descendente y `created_at` ascendente para desempatar. Se muestra en `/salon` (podio + tabla) y en el bloque de marcas de `/juegos/[id]`. Un juego con menos de 10 marcas muestra solo las que hay; sin marcas muestra un estado vacío.
- Guardado: al pulsar GUARDAR PUNTUACIÓN en `asteroids`, `GamePlayer` inserta en `scores` desde el navegador (`lib/supabase/client.ts`) y además mantiene `saveScore` de `useSession` (copia local en `av_scores`). Los otros 8 juegos siguen solo con `saveScore`.
- Estados de la UI al guardar: guardando, guardado y error (el error no pierde la marca local y permite reintentar).
- La fila "TU MEJOR MARCA" del Salón pasa a calcularse con la mejor entrada de `av_scores` del usuario en el juego seleccionado, sin rango inventado (`—`); se oculta si no hay ninguna.

**Fuera de alcance (para specs futuros):**

- Supabase Auth, `user_id` en `scores`, RLS por usuario y `proxy.ts`.
- Antifraude real (validación de la partida en servidor, firmas, límites por IP). Solo hay restricciones `CHECK` básicas.
- Paginación del leaderboard, top 50 o "mejor marca por jugador".
- Realtime (actualizar el ranking en vivo) y Edge Functions.
- Que los otros 8 juegos escriban en `scores`: siguen con partida simulada y solo `localStorage`.
- Panel de administración para crear o editar juegos (se editan por SQL o migración).
- Sincronizar o importar las entradas antiguas de `av_scores` a Supabase.
- Cambios visuales de diseño: se reutilizan las clases CSS existentes del Salón y del detalle.
- Tests automatizados, SEO avanzado, i18n.

## Modelo de datos

```sql
-- supabase/migrations/<timestamp>_games_and_scores.sql
create table public.games (
  id         text primary key,                 -- 'asteroids', 'bloque-buster', ...
  title      text not null,
  short      text not null,
  long       text not null,
  cat        text not null check (cat in ('ARCADE','PUZZLE','SHOOTER','VERSUS')),
  cover      text not null,                    -- clase CSS, p. ej. 'cover-rocas'
  color      text not null check (color in ('cyan','magenta','yellow','green')),
  position   int  not null unique,             -- orden del catálogo (el de lib/games.ts)
  created_at timestamptz not null default now()
);

create table public.scores (
  id         bigint generated always as identity primary key,
  game_id    text not null references public.games(id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 10),
  score      int  not null check (score between 0 and 10000000),
  created_at timestamptz not null default now()
);

create index scores_game_rank_idx on public.scores (game_id, score desc, created_at asc);

create view public.games_with_stats with (security_invoker = true) as
  select g.*, coalesce(max(s.score), 0) as best, count(s.id) as plays
  from public.games g left join public.scores s on s.game_id = g.id
  group by g.id;
```

```sql
-- RLS (activado en ambas tablas)
-- games:  select para anon y authenticated; sin insert/update/delete desde cliente.
-- scores: select para anon y authenticated; insert para anon y authenticated;
--         sin update ni delete desde cliente.
```

```ts
// lib/games.ts
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
export async function getGames(): Promise<Game[]>; // games_with_stats ordenado por position
export async function getGame(id: string): Promise<Game | null>;

// lib/scores.ts — reemplaza a seededScores
export interface ScoreRow {
  rank: number;
  name: string;
  score: number;
  date: string;
} // date dd/mm/yyyy
export async function getTopScores(
  gameId: string,
  limit = 10,
): Promise<ScoreRow[]>;
```

Convenciones:

- `best` y `plays` ya no están sembrados en la base; `plays` pasa de cadena (`"12.4K"`) a número y se formatea con `toLocaleString("es-ES")` en la UI.
- El nombre llega ya en mayúsculas y con un máximo de 10 caracteres desde el modal de `GamePlayer`; la restricción `CHECK` es la segunda barrera.
- Los clientes nuevos se tipan con `Database` de `lib/supabase/database.types.ts`.
- Las lecturas cacheadas (`getGames`, `getGame`) usan `lib/supabase/public.ts`; el leaderboard del Salón al cambiar de pestaña se lee desde el navegador con `lib/supabase/client.ts`.
- `cacheTag("scores-<gameId>")` en las lecturas del leaderboard que se hagan en servidor (`/juegos/[id]`) y se invalida tras insertar con `revalidateTag` desde una Server Action mínima `app/juegos/[id]/jugar/actions.ts` que el cliente llama después de un insert exitoso. Si el paso 8 muestra que no es necesaria, se documenta y se omite.
- `ScoreRow.rank` se calcula en código (índice + 1) después de ordenar.

## Plan de implementación

Antes de empezar, leer en `node_modules/next/dist/docs/01-app/` las guías de `cacheComponents`, `use cache`, `cacheTag` y `revalidateTag`, de Server y Client Components y de `generateStaticParams`; y la guía de RLS con `mcp__supabase__search_docs`. Usar `/frontend-design` solo para el estado vacío y los estados de guardado, reutilizando las clases existentes.

1. Escribir `supabase/migrations/<timestamp>_games_and_scores.sql` con las tablas, el índice, la vista, RLS y la siembra de los 9 juegos (con `position` según el orden actual de `lib/games.ts`). Aplicarla con `apply_migration`. Verificación: `list_tables` muestra `games` y `scores` con RLS activado, `select count(*) from games` devuelve 9 y `get_advisors` (seguridad) no reporta tablas sin RLS.
2. Generar `lib/supabase/database.types.ts` con `generate_typescript_types` y tipar `lib/supabase/client.ts` y `lib/supabase/server.ts` con `Database`. Crear `lib/supabase/public.ts` (cliente sin cookies). Verificación: `npm run build` compila.
3. Reescribir `lib/games.ts`: conservar tipos y `CATS`, añadir `getGames()` y `getGame()` con `"use cache"`, `cacheTag("games")` y el cliente `public.ts`. Verificación: compila; sin consumidores migrados todavía no es válido, así que este paso incluye el siguiente.
4. Migrar los consumidores del catálogo a `await getGames()` / `getGame()` desde Server Components (home, biblioteca, detalle, jugar, salón) y pasar los datos por props a `library.tsx`, `game-card.tsx` y `hall-of-fame.tsx`; `generateStaticParams` usa `getGames()`. Verificación: `/`, `/biblioteca`, `/juegos/asteroids`, `/juegos/asteroids/jugar` y `/salon` se ven igual que antes salvo `best`/`plays` en 0; `npm run build` compila.
5. Reescribir `lib/scores.ts` con `getTopScores` y eliminar `seededScores`. Conectar el bloque de marcas de `/juegos/[id]` a `getTopScores(id)` con su estado vacío. Verificación: el detalle muestra "sin marcas" mientras `scores` está vacía.
6. Conectar `components/hall-of-fame.tsx` a `getTopScores` desde el navegador al cambiar de pestaña, con estado de carga, estado vacío y podio que tolera menos de 3 filas. Sustituir la fila "TU MEJOR MARCA" por la lectura de `av_scores`. Verificación: todas las pestañas cargan sin errores y las pestañas sin marcas muestran el estado vacío.
7. Guardado en `components/game-player.tsx`: para `gameId === "asteroids"`, `onClick` de GUARDAR PUNTUACIÓN inserta en `scores` con `lib/supabase/client.ts`, llama a `saveScore` y gestiona los estados guardando, guardado y error con reintento. Los otros juegos conservan el flujo actual. Verificación: jugar una partida de Asteroids, guardar y ver una fila nueva con `execute_sql`.
8. Revalidación: si las páginas cacheadas del detalle muestran marcas obsoletas, añadir `app/juegos/[id]/jugar/actions.ts` con `revalidateTag` y llamarla tras el insert; si no, documentarlo y omitir. Verificación: tras guardar, el detalle y el Salón muestran la marca nueva sin reiniciar el servidor.
9. Limpieza: quitar importaciones muertas, revisar que `lib/games.ts` no contiene datos sembrados y ejecutar `npm run lint` y `npm run build`. Verificación: sin errores.

## Criterios de aceptación

- [ ] `list_tables` del esquema `public` devuelve `games` y `scores` con RLS activado, y existe la vista `games_with_stats`.
- [ ] `games` contiene exactamente los 9 juegos del catálogo anterior con los mismos `id`, `title`, `cat`, `cover` y `color`, y `position` del 1 al 9.
- [ ] El esquema se creó con una migración versionada en `supabase/migrations/`.
- [ ] Un `insert` con `anon` en `scores` con `name` vacío, de más de 10 caracteres, `score` negativo o `game_id` inexistente es rechazado por la base de datos.
- [ ] Con `anon` no se puede hacer `update`, `delete` ni `insert` sobre `games`, ni `update` ni `delete` sobre `scores`.
- [ ] `get_advisors` de seguridad no reporta tablas sin RLS ni vistas con `security definer`.
- [ ] `lib/games.ts` no contiene el arreglo `GAMES` ni datos de juegos, y `lib/scores.ts` no contiene `seededScores`.
- [ ] `/`, `/biblioteca`, `/juegos/<id>`, `/juegos/<id>/jugar` y `/salon` muestran los 9 juegos leídos de Supabase y no hay errores en la consola del navegador.
- [ ] El filtro por categoría y la búsqueda de `/biblioteca` siguen funcionando.
- [ ] Un juego sin marcas muestra `0` de mejor marca y `0` de partidas en su tarjeta y detalle, y un estado vacío en su leaderboard.
- [ ] Jugar Asteroids, terminar la partida y pulsar GUARDAR PUNTUACIÓN crea una fila en `scores` con `game_id = 'asteroids'`, el nombre en mayúsculas y la puntuación final correcta.
- [ ] Esa misma marca también queda en `localStorage` (`av_scores`).
- [ ] La marca guardada aparece en `/salon` (pestaña ASTEROIDS) y en `/juegos/asteroids` sin reiniciar el servidor, y la mejor marca de la tarjeta pasa a ser el `MAX(score)` real.
- [ ] El leaderboard muestra como máximo 10 filas, ordenadas por puntuación descendente y fecha ascendente para desempatar, y permite nombres repetidos.
- [ ] El podio de `/salon` no falla con 0, 1 o 2 marcas.
- [ ] Si la inserción falla (por ejemplo sin red), el modal muestra un error, conserva la marca en `av_scores`, no marca la partida como guardada y permite reintentar.
- [ ] Guardar una puntuación de uno de los otros 8 juegos no crea filas en `scores`.
- [ ] La fila "TU MEJOR MARCA" muestra la mejor entrada local del usuario en el juego seleccionado con rango `—`, y no aparece si no hay entradas o no hay sesión.
- [ ] No hay claves `service_role` ni `secret` en el código ni en `.next/static`.
- [ ] `npm run lint` y `npm run build` terminan sin errores.

## Decisiones

- **Sí:** tabla `games` como fuente de verdad del catálogo. Decisión explícita del usuario; elimina la duplicación entre el código y la base.
- **Sí:** `best` y `plays` derivados de `scores` con una vista. Evita datos desincronizados; el precio es perder los números sembrados ("12.4K" partidas), que dejan de ser reales.
- **No:** columnas `best` y `plays` sembradas en `games`. Se desactualizarían con cada partida real.
- **No:** contador `plays` incrementado por trigger o por código. `COUNT(*)` es suficiente a esta escala y no tiene estado que corromper.
- **Sí:** el leaderboard reemplaza los datos sembrados, sin mezclarlos. Decisión explícita del usuario; los juegos simulados muestran estado vacío en lugar de datos falsos.
- **Sí:** inserción anónima con nombre libre y RLS. Decisión explícita del usuario: no hay Auth todavía.
- **No:** Server Action como único camino de escritura. Añadiría una capa sin dar seguridad real mientras no haya identidad; solo se usa, si hace falta, para `revalidateTag`.
- **No:** Supabase Auth ni `user_id`. Spec propio; el diseño actual permite añadir una columna `user_id` nullable después.
- **Sí:** top 10 con todas las partidas y desempate por fecha. Es lo más simple y predecible; "mejor marca por jugador" necesita identidad real.
- **Sí:** solo Asteroids escribe en Supabase. Es el único juego con puntuación real; los demás generan números aleatorios sin sentido.
- **Sí:** Supabase y `localStorage` a la vez para guardar. `av_scores` queda como copia local y alimenta "TU MEJOR MARCA"; si la red falla no se pierde la marca.
- **Sí:** cliente `public.ts` sin cookies para lecturas cacheadas. `cookies()` en `server.ts` hace la ruta dinámica y choca con `"use cache"`.
- **Sí:** `CHECK` de `score <= 10000000` y `name` de 1 a 10. Es una barrera mínima contra basura, no antifraude.
- **Sí:** migración versionada en `supabase/migrations/` aplicada con el MCP. El SPEC 04 dejó esta carpeta para la primera migración.
- **No:** panel de administración de juegos ni importar `av_scores` antiguos. Cada uno va en su spec.

## Riesgos

| Riesgo                                                                                       | Mitigación                                                                                                                   |
| -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Cualquiera puede insertar puntuaciones falsas con la clave pública (`curl` directo a la API) | Riesgo aceptado y documentado; `CHECK` limita el rango y el antifraude real va en un spec con Auth y validación en servidor. |
| Con `cacheComponents`, las páginas cacheadas muestran marcas obsoletas tras guardar          | Leaderboard del Salón leído en cliente; para el detalle, `cacheTag` + `revalidateTag` (paso 8) o lectura sin caché.          |
| `"use cache"` con un cliente que usa `cookies()` rompe el build o vuelve dinámica la ruta    | Las lecturas cacheadas usan `lib/supabase/public.ts`, sin cookies.                                                           |
| Cambio de `plays` de cadena a número rompe componentes que lo muestran                       | El tipo `Game` cambia y el compilador marca todos los usos; el formateo se centraliza.                                       |
| Migrar el catálogo a la base deja la app sin juegos si Supabase está caído                   | `getGames` propaga el error a `error.tsx` más cercano; no se añade fallback local para no mantener dos fuentes de verdad.    |
| Vista `games_with_stats` expone datos fuera de RLS                                           | `security_invoker = true` y verificación con `get_advisors`.                                                                 |
| Spam de filas en `scores` llena la tabla                                                     | Riesgo aceptado a esta escala; límites por IP o Auth van en un spec futuro.                                                  |
| La carpeta `supabase/` sin `supabase init` puede confundir al CLI                            | Solo se guardan los `.sql` de migración como registro; el aplicado se hace por MCP. Documentado en el commit.                |
| La siembra cambia ids o textos respecto a `lib/games.ts` y rompe enlaces                     | La migración copia literalmente los datos del archivo; un criterio de aceptación compara los 9 registros.                    |

## Qué **no** está en este spec

- Supabase Auth, `user_id`, `proxy.ts` y RLS por usuario.
- Antifraude, validación de partidas en servidor y límites por IP.
- Paginación, top 50 y "mejor marca por jugador".
- Realtime y Edge Functions.
- Que los otros 8 juegos guarden en `scores`.
- Panel de administración de juegos.
- Importar entradas antiguas de `av_scores` a Supabase.
- Cambios visuales de diseño más allá de los estados vacío, de carga y de error.
- Tests automatizados, SEO avanzado e i18n.

Cada uno de estos puntos, si se aborda, va en su propio spec.
