# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Arcade Vault: a platform to play games online and compete for the highest score. The project follows spec-driven development (`/spec` and `/spec-impl` skills, installed via `npx skills@latest add Klerith/fernando-skills`). The codebase is currently the fresh `create-next-app` scaffold (single `app/page.tsx`, no game logic yet).

## Commands

```bash
npm run dev     # next dev (Turbopack)
npm run build   # next build
npm run start   # serve production build
npm run lint    # eslint (flat config, eslint.config.mjs)
```

No test runner is configured yet.

## Next.js version caveat

This uses Next.js 16.4 / React 19.3, which differs from older Next.js APIs. `AGENTS.md` requires reading the relevant guide in `node_modules/next/dist/docs/` (`01-app`, `02-pages`, `03-architecture`, ...) before writing Next.js code, and heeding deprecation notices.

## Architecture notes

- App Router only (`app/`). Path alias `@/*` maps to the repo root.
- `next.config.ts` enables `cacheComponents`, `partialPrefetching` and `experimental.agentFeedback`. `cacheComponents` changes caching/rendering semantics, so check the docs before using data fetching or dynamic APIs.
- Tailwind CSS v4 is wired through a Turbopack rule (`@tailwindcss/turbopack` loader for `*.css`) in `next.config.ts`, not PostCSS. Theme tokens (`--background`, `--foreground`, fonts) are defined in `app/globals.css` via `@theme inline`, with a dark-mode override.
- `app/layout.tsx` uses the globally typed `LayoutProps<"/">` helper (no import) and loads Geist / Geist Mono through `next/font/google`.
