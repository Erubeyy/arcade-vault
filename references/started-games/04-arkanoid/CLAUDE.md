# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Status

Early-stage Arkanoid/Breakout browser game. So far the repo contains only assets: there is no HTML entry point, game code, package.json, build system, linter, or tests yet (`README.md` is empty, and this is not a git repo). Update this file with real commands once they exist.

## Assets

- `assets/spritesheet.js` is a plain browser script (no modules/bundler) that defines globals: `SPRITES`, `EXPLOSION_FRAMES`, `EXPLOSION_DURATION`, `loadSpritesheet(cb)`, `drawFrame(ctx, frame, x, y, w, h)`, and `drawSprite(ctx, name, x, y, w, h)`. It must be loaded with a `<script>` tag before game code.
  - `loadSpritesheet(cb)` loads `assets/spritesheet-breakout.png` (path is relative to the HTML page, so the page must sit at the project root) and copies it to an offscreen canvas. Drawing silently no-ops until loading finishes, so start the game loop from the callback.
  - `drawSprite` takes names `paddle`, `ball`, or `block_<color>` (colors: gray, red, yellow, cyan, magenta, hotpink, green).
  - `EXPLOSION_FRAMES[color]` is a 4-frame break animation per block color, shown for `EXPLOSION_DURATION` (150 ms). The `gray` frames reuse the red ones.
- `assets/sounds/ball-bounce.mp3` and `break-sound.mp3` are the sound effects for ball bounces and block breaks.
- Serve over HTTP (e.g. `python3 -m http.server`) rather than `file://`, since the spritesheet is read from canvas pixels and audio is loaded by path.
