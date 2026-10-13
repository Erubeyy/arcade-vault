# Arkanoid

A browser Arkanoid/Breakout game built with vanilla JavaScript on an HTML `<canvas>`. Zero dependencies, no build step, no modules: plain `<script>` tags that share globals.

- **Status:** playable. 8 levels, pause menu, score and lives.
- **Developed with specs:** every feature starts as a spec in [`specs/`](specs/) and is implemented step by step. See [Specs](#specs).

---

## Running the game

The spritesheet is read from canvas pixels and audio is loaded by path, so it must be served over HTTP (not `file://`).

```bash
python3 -m http.server
# then open http://localhost:8000
```

There is no package manager, linter, or test suite. Verification is manual, against the acceptance criteria of each spec.

---

## Controls

| Key | Action |
| --- | ------ |
| Left / Right arrows, A / D | Move the paddle |
| Space | Launch the ball (when it sits on the paddle) |
| Space / Enter | Play again from the game-over or win screen |
| ESC | Pause (from ready or playing); resume; go back from the level list |
| Up / Down | Move through the pause menu |
| Enter | Select the highlighted menu item |

### Pause menu

| Item | Result |
| ---- | ------ |
| Resume | Continue exactly where the game stopped |
| Restart level | Reload the current level with score 0 and 3 lives |
| Change level | Open a list of all 8 levels; picking one starts it with score 0 and 3 lives |
| Finish game | Go to the game-over screen (Space/Enter then starts again at level 1) |

---

## Gameplay rules

- **Lives and score:** 3 lives. Losing the ball below the paddle costs a life and puts the ball back on the paddle.
- **Blocks:** colored blocks break in 1 hit for 10 points. Gray blocks take 2 hits and give 50 points when they break.
- **Paddle bounce:** the angle depends on where the ball hits the paddle (up to 60 degrees from vertical). Ball speed stays constant.
- **Progression:** clearing a level loads the next one with score and lives kept. Clearing level 8 wins the game.
- **Difficulty:** ball speed rises by 30 px/s per level, and later levels use more gray blocks.

### Levels

Level 1 is the original layout. Levels are defined in [`levels.js`](levels.js).

| Level | Figure | Ball speed (px/s) |
| ----- | ------ | ----------------- |
| 1 | Classic | 360 |
| 2 | Pyramid | 390 |
| 3 | Checkerboard | 420 |
| 4 | Diamond | 450 |
| 5 | Pillars | 480 |
| 6 | Invader | 510 |
| 7 | Fortress | 540 |
| 8 | X | 570 |

---

## Project structure

```
index.html              Canvas (800x600) and script tags, in load order
game.js                 Game state, input, physics, rendering, pause menu
levels.js               LEVELS and LEVEL_CHARS (block layouts and speeds)
assets/
  spritesheet.js        Sprite helpers (do not modify)
  spritesheet-breakout.png
  sounds/               ball-bounce.mp3, break-sound.mp3
specs/                  Specs and workflow config
CLAUDE.md               Guidance for Claude Code
```

Script load order matters: `assets/spritesheet.js`, then `levels.js`, then `game.js`.

---

## Architecture

### `game.js`

One global `game` object holds all state:

| Field | Meaning |
| ----- | ------- |
| `state` | `'ready'`, `'playing'`, `'paused'`, `'gameover'` or `'won'` |
| `level` | Current level, 1 to `LEVELS.length` |
| `score`, `lives` | Run stats |
| `paddle`, `ball` | Position, size and (for the ball) velocity |
| `blocks` | `{ x, y, color, hits, points, alive }` |
| `explosions` | `{ x, y, color, start }`, drawn for `EXPLOSION_DURATION` (150 ms) |
| `prevState`, `pausedAt`, `menu` | Pause bookkeeping (`menu` is `{ screen: 'main' \| 'levels', index }`) |

State flow:

```
ready --Space--> playing --last block, level < 8--> ready (next level)
  |  ^              |  \--last block, level 8--> won
  |  |              \--no lives left--> gameover
  \--ESC--> paused --ESC / Resume--> back to previous state
                     Finish game --> gameover
gameover / won --Space or Enter--> ready (level 1, fresh run)
```

Main functions:

| Function | Role |
| -------- | ---- |
| `update(dt)` | Per-frame logic: paddle, ready-state ball, sub-stepped ball movement. No-op while paused |
| `stepBall(dt)` | Moves the ball and resolves wall, paddle, block and floor collisions |
| `draw()` | Draws blocks, explosions, paddle, ball, HUD, and the overlays |
| `createBlocks()` | Builds blocks from `LEVELS[game.level - 1]` |
| `loadLevel(n)` | Loads a level and returns the ball to the paddle in `ready` |
| `startLevelFresh(n)` | `loadLevel` plus score 0 and full lives |
| `resetGame()` | New run at level 1 |
| `pauseGame()` / `resumeGame()` | Enter and leave `paused`, keeping explosion timers consistent |
| `handleMenuKey()` / `selectMenuItem()` | Pause menu navigation and actions |
| `levelSpeed()` | Ball speed of the active level |

Physics notes:

- Movement uses delta time clamped to `MAX_DT` (50 ms), so speed is independent of frame rate.
- The ball moves in sub-steps of at most `MAX_STEP_PX` (8 px), so fast levels do not tunnel through blocks or the paddle.
- Block collisions resolve along the axis of smallest penetration, one block per sub-step.
- Coordinates: origin top-left, `y` grows downward. Velocities are px/s.

### `levels.js`

Each level is `{ speed, rows }`. `rows` holds up to 10 strings of exactly 10 characters, one per block row, starting at `GRID_Y`.

| Char | Block |
| ---- | ----- |
| `.` | empty |
| `g` | gray (2 hits) |
| `r` `y` `c` `m` `h` `e` | red, yellow, cyan, magenta, hotpink, green (1 hit) |

An unknown character is skipped with a `console.warn`.

**Adding a level:** append an entry to `LEVELS` with a `speed` and `rows`. The pause menu list and the win condition (`LEVELS.length`) pick it up automatically. Keep rows 10 characters wide and at most 10 rows so the figure stays above the paddle.

### Assets

`assets/spritesheet.js` defines the globals `SPRITES`, `EXPLOSION_FRAMES`, `EXPLOSION_DURATION`, `loadSpritesheet(cb)`, `drawFrame()` and `drawSprite()`.

- Sprite names: `paddle`, `ball`, `block_<color>` (gray, red, yellow, cyan, magenta, hotpink, green).
- `loadSpritesheet(cb)` must finish before drawing; the game loop starts from its callback.

---

## Specs

Features are designed as specs in [`specs/`](specs/) and implemented with the `/spec` and `/spec-impl` workflow. A spec holds the scope, data model, implementation plan, acceptance criteria, decisions and risks, so it is the first place to look when reviewing a change.

| Spec | Title | Status | Summary |
| ---- | ----- | ------ | ------- |
| [01](specs/01-playable-mvp.md) | Playable MVP | Implemented | Paddle, ball, 10x6 block grid, score, 3 lives, win/game-over with restart, sounds, explosions |
| [02](specs/02-levels-and-pause-menu.md) | Levels and pause menu | Implemented | 8 levels with distinct figures and rising speed, auto-progression, ESC pause menu |

### Changes by spec

**SPEC 01**
- Added `index.html` and `game.js`.
- Game states `ready`, `playing`, `gameover`, `won`.
- Fixed single layout, gray 2-hit blocks, sound effects and break animation.

**SPEC 02**
- Added `levels.js` and its `<script>` tag in `index.html`.
- `game.js`: removed the fixed layout (`ROW_COLORS`, `GRID_ROWS`) and the `BALL_SPEED` constant. Blocks and speed now come from `LEVELS`.
- `game.js`: new `paused` state, pause menu, level progression, and sub-stepped ball movement (`stepBall`).
- HUD now shows the level number.

### Reviewing a change

1. Read the spec's Scope and Decisions to see what was intended and what was ruled out.
2. Follow the Implementation plan: each step was a reviewable unit.
3. Check the diff against the Acceptance criteria, which are boolean and checked manually in the browser.
4. Update the spec status to `Implemented` once the criteria pass.

### Not implemented yet

Intentionally left out of SPEC 01 and 02, each of them needs its own spec:

- Title screen, level names or intro banners.
- Power-ups, multi-ball, paddle resizing.
- High scores, saved progress or level unlocking.
- Mouse or touch input.
- Random layouts or a level editor.
- Responsive canvas scaling.
- Pause and menu sounds.
