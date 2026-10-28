# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Arcade Vault: a platform to play games online and compete for the highest score. UI copy and specs are in Spanish. The project follows spec-driven development: every feature has a spec in `specs/NN-slug.md` (status `Borrador` → `Aprobado` → `Implementado`), written with `/spec` and implemented with `/spec-impl` (installed via `npx skills@latest add Klerith/fernando-skills`). Each spec is implemented on its own branch `spec-NN-slug` and merged through a PR.

No test runner is configured yet. Verify with `npm run lint`, `npm run build` and by running the app.

A `PostToolUse` hook in `.claude/settings.json` runs Prettier and `eslint --fix` on every file written or edited inside the project, so files may change formatting right after a Write/Edit.

## Commands

```bash
npm run dev     # next dev (Turbopack)
npm run build   # next build
npm run start   # serve production build
npm run lint    # eslint (flat config, eslint.config.mjs)
```

## Skills

- Always use `/frontend-design` to design user interfaces.
- `/spec` and `/spec-impl` (global, in `~/.claude/skills`): write and implement specs. `specs/.spec-config.yml` sets `AutoCreateBranch: true`, so `/spec-impl` creates the `spec-NN-slug` branch without asking.
- `game-planner` (project subagent, `.claude/agents/game-planner.md`): recommends which game to build next from the real catalog and `references/`, and keeps the suggestion history (pending/accepted/implemented/discarded) in `references/game-suggestions-todo.md`. Feed its pick to `/new-game`.
- `/new-game <name or references/started-games folder>` (project skill, `.claude/skills/new-game/`): designs the spec for a new game (or a port from `references/started-games/`) with Supabase catalog entry and leaderboard. It only writes the spec; code is then produced with `/spec-impl`. Its `integration.md` documents the engine/registry architecture and the verification checklist. Manual invocation only.
- `/spec-impl-game <NN-juego-slug>` (project skill, `.claude/skills/spec-impl-game/`): same flow as `/spec-impl` for game specs (approved-only, `spec-NN-slug` branch, step by step, no auto-commits) and, once the implementation and lint/build pass, runs `skin-designer` and then `mobile-porter` on that game, one after the other (never in parallel). Manual invocation only.
- `game-jam` (project subagent, `.claude/agents/game-jam.md`): give it a game or an idea and it writes at least 2 full spec variants of that game, one file each, to `specs/game-jam/<game-id>-vN.md` (status `Borrador`, no `NN`, same format as specs 07-09) so you can pick one. It writes only there and never overwrites (a second jam of the same game continues the numbering: `-v3`, `-v4`...). To implement a variant: move it to `specs/NN-juego-<slug>.md`, drop "JAM" from the title, set `Aprobado` and run `/spec-impl`.
- `skin-designer` (project subagent, `.claude/agents/skin-designer.md`): `skin-designer: <game>` ensures ONE real game has at least 3 skins (`classic` as default, `neon`, `retro`), all readable in dark and light mode, with a selector in its options panel and persisted preferences; verifies with Playwright and records the result in `references/game-with-themes.md`.
- `mobile-porter` (project subagent, `.claude/agents/mobile-porter.md`): `mobile-porter: <route or game>` audits and fixes ONE route or real game for mobile browsers (portrait and landscape, desktop untouched), using spec 10 as reference, verifies with Playwright at 375×667, 390×844, 844×390 and 1280×800, and records the result in `references/mobile-ready.md`. Browser only (no PWA/native).

`game-planner`, `skin-designer` and `mobile-porter` use `memory: project`; their notes live in `.claude/agent-memory/<agent>/`.

## Specs implemented

| Spec   | Content                                                                             |
| ------ | ----------------------------------------------------------------------------------- |
| 01     | MVP of the visual screens (library, game detail, player, hall of fame, login)       |
| 02, 03 | Home, nav, About page and contact form (Resend)                                     |
| 04     | Supabase connection (`@supabase/ssr`)                                               |
| 05     | Asteroids (first real game)                                                         |
| 06     | `games` / `scores` in Supabase, dynamic catalog and leaderboard                     |
| 07     | Tetris (replaces placeholder `caida`)                                               |
| 08     | Arkanoid (replaces placeholder `bloque-buster`)                                     |
| 09     | Snake (replaces placeholder `serpentina`)                                           |
| 10     | Touch controls: virtual gamepad (d-pad + A/B) under the canvas                      |
| 11     | Frogger (replaces placeholder `ranaria`)                                            |
| 12     | Supabase Auth: email/password + Google/GitHub, `profiles`, scores only with session |
| 13     | Security basics: security headers, RLS audit, `rls_auto_enable()` RPC revoked       |

Later fixes: the game-over screen has a REGRESAR option (back to the game page with leaderboard) and resets game state when leaving via REGRESAR or VOLVER AL VAULT.

## Next.js version caveat

This uses Next.js 16.4 / React 19.3, which differs from older Next.js APIs. `AGENTS.md` requires reading the relevant guide in `node_modules/next/dist/docs/` (`01-app`, `02-pages`, `03-architecture`, ...) before writing Next.js code, and heeding deprecation notices. `AGENTS.md` is rewritten by `next dev`; commit it with your work.

## Architecture notes

- App Router only (`app/`). Path alias `@/*` maps to the repo root.
- Routes: `/` (home), `/about` (contact form, server action `app/about/actions.ts` sends mail via Resend), `/biblioteca` (catalog), `/juegos/[id]` (game detail + leaderboard), `/juegos/[id]/jugar` (player), `/salon` (hall of fame), `/login` (sign in / sign up / OAuth / guest), `/perfil/completar` (username for OAuth users without profile), `/recuperar` + `/restablecer` (password reset), `/auth/callback` (route handler: exchanges the PKCE `code`, only internal `next`).
- `next.config.ts` enables `cacheComponents`, `partialPrefetching` and `experimental.agentFeedback`. `cacheComponents` changes caching/rendering semantics: server reads use `"use cache"` + `cacheTag`, so check the docs before using data fetching or dynamic APIs.
- Tailwind CSS v4 is wired through a Turbopack rule (`@tailwindcss/turbopack` loader for `*.css`) in `next.config.ts`, not PostCSS. Theme tokens (`--background`, `--foreground`, fonts) are defined in `app/globals.css` via `@theme inline`, with a dark-mode override.
- `app/layout.tsx` uses the globally typed `LayoutProps<"/">` helper (no import) and loads Geist / Geist Mono through `next/font/google`.
- `references/` holds design templates (`templates/`), original standalone games (`started-games/`: asteroids, tetris, arkanoid) and raw assets (`source-assets/`). They are source material, not app code. It also holds registries kept by the agents/skills: `game-suggestions-todo.md` (`game-planner`), `game-with-themes.md` (`skin-designer`), `mobile-ready.md` (`mobile-porter`) and `implemented-games.md` (catalog rows of the implemented games).

### Supabase

- Project is connected through `.mcp.json` (Supabase MCP, project-scoped) and env vars in `.env.local`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_DB_PASSWORD`, plus `RESEND_API_KEY` and `CONTACT_TO_EMAIL` for the contact form. Never commit or print them.
- Clients in `lib/supabase/`: `server.ts` (`createClient`, cookie-based, for request-time code), `public.ts` (`createPublicClient`, cookie-less, safe inside `"use cache"`), `client.ts` (browser). Types in `database.types.ts` (`Database`).
- Schema lives in `supabase/migrations/` (timestamped SQL): `games` table, `scores` table, `games_with_stats` view (adds `best` and `plays`), `profiles` table (`id` → `auth.users`, unique uppercase `username`, trigger `on_auth_user_created` fills it from signup metadata) with RLS. `scores` inserts are allowed only to `authenticated` users whose `name` equals their profile `username` (`scores_insert_own`). Each new game adds a migration (`*_game_<name>.sql`: tetris, arkanoid, snake, frogger) that replaces its placeholder row in `games` (same `id`).
- Reads: `lib/games.ts` (`getGames`, tag `games`) and `lib/scores.ts` (`getTopScores`, tag `scores-<gameId>`); `lib/scores-query.ts` has the shared `queryTopScores` also used from the browser (hall of fame). After saving a score, call the server action `revalidateScores(gameId)` in `app/juegos/[id]/jugar/actions.ts` to invalidate both tags.
- Auth: `proxy.ts` (with `lib/supabase/proxy.ts` `updateSession`) only refreshes session cookies; no route requires login, only saving a score does. `lib/session.tsx` wraps Supabase Auth: `useSession()` returns `{ user, status, signOut }` with `status` `loading | guest | needs-profile | ready`. `lib/auth.ts` holds username/password validation and Spanish error messages. `scores.name` is the profile `username` (no `user_id` yet). The Supabase dashboard must have Site URL/Redirect URLs, "Confirm email", min password 8 and the Google/GitHub providers configured (not versioned).
- Security (spec 13): `next.config.ts` sets `securityHeaders` on every route (nosniff, `X-Frame-Options: DENY`, Referrer-Policy, HSTS without preload, Permissions-Policy); there is no CSP yet. RLS is on in `games`, `scores` and `profiles` with no `update`/`delete` policies; keep it that way and add RLS to every new table. `public.rls_auto_enable()` (event trigger `ensure_rls`) has `EXECUTE` revoked from `anon`/`authenticated`. Sign-up/sign-in rate limits per IP are set in the Supabase dashboard (not versioned). Leaked password protection is pending (needs the Pro plan). Checklist in `references/security/security-checklist.md`.

### Games

- Engine contract in `lib/games/engine.ts`: `GameEngine` (`start/pause/resume/restart/end/destroy`), `GameCallbacks` (`onStats`, `onGameOver`) and `EngineFactory`. Optional `setInput(button, pressed)` / `releaseInput()` take the virtual gamepad buttons (`VirtualButton`: `up/down/left/right/a/b`). Engines are plain TS classes with no React or DOM globals beyond the canvas they receive.
- `lib/games/registry.ts` maps a catalog `id` to its `GameDefinition` (`create`, canvas `width`/`height`, `controls` hint, `pad`: which virtual buttons the game uses, with accessible labels). `isRealGame(id)` tells real games from games still using the simulated match. Real games: `asteroids`, `caida` (Tetris), `bloque-buster` (Arkanoid), `serpentina` (Snake), `ranaria` (Frogger). The ids of the old placeholders were kept.
- `components/game-canvas.tsx` hosts any registered engine; `components/game-player.tsx` owns the HUD, pause/restart/end and game-over flow; `components/touch-pad.tsx` is the virtual gamepad shown under the canvas on touch screens.
- Per-game folders in `lib/games/<name>/` (`engine.ts`, `skins.ts`, `prefs.ts` plus entities, sprites, levels, board or render as needed). Every real game has an option panel (`components/<game>-options.tsx`) to pick skin and settings; preferences are persisted via each game's `prefs.ts` (localStorage `av_<game>_prefs`), passed to the engine as `options`, and skin changes apply live with `engine.setSkin`. Skins are `classic` (default), `neon` and `retro` (Arkanoid adds `arcade`).
- To add a game: run `/new-game`, approve the spec, then `/spec-impl-game` (implementation + skins + mobile).
