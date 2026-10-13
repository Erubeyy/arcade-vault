# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Asteroids clone in plain HTML5 Canvas + vanilla JS. No dependencies, no bundler, no package.json, no tests, no linter. The README and code comments are in Spanish; keep new user-facing strings (HUD, overlays) and comments in Spanish to match.

## Running

Open `index.html` directly in a browser, or serve the folder with `npx serve .` (http://localhost:3000). There is no build step; edit and reload.

## Architecture

All game logic lives in a single script, `game.js`, loaded by `index.html` (which only provides the 800×600 `<canvas id="canvas">`). `W`/`H` constants in `game.js` must stay in sync with the canvas size in `index.html`.

- **Entities** (`Bullet`, `Asteroid`, `Ship`, `Particle`) are classes with `update(dt)` and `draw()`. Removal is via a `dead` flag; the main update filters dead entities out of the arrays afterwards (`bullets`, `asteroids`, `particles` are module-level `let` arrays that get reassigned).
- **Toroidal world**: positions wrap using `wrap(v, max)`. Particles do not wrap.
- **Game state** is module-level globals (`ship`, `score`, `lives`, `level`, `state`, `deadTimer`). `state` is `'playing' | 'dead' | 'gameover'`; `update(dt)` branches on it at the top. `initGame()` resets everything, `nextLevel()` runs when `asteroids.length === 0`.
- **Loop**: `requestAnimationFrame` → `update(dt)` → `draw()`. `dt` is in seconds and clamped to 0.05 to avoid big jumps after tab switches. All speeds/thrust are in px/s (or px/s²) and multiplied by `dt`.
- **Input**: `keys[e.code]` holds held state (used for rotate/thrust); `pressed(code)` is a one-shot "just pressed" that consumes the flag (used for shooting and restart). Use `pressed` for edge-triggered actions, `keys` for continuous ones.
- **Asteroid sizes** are 1–3 and index into the parallel `RADII`, `SPEEDS`, `POINTS` arrays (index 0 is an unused placeholder). Note that smaller asteroids give more points. `split()` spawns two of `size - 1`.
- **Collisions** are circle-based via `dist()`. Ship vs asteroid uses `a.radius * 0.82` as a forgiveness factor; the ship is skipped while `ship.invincible > 0` (also drives the respawn blink in `Ship.draw`).

## Notes

- The README mentions power-ups and a "shooting star" asteroid type; these are not implemented in `game.js`.
