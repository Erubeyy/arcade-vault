const WIDTH = 800, HEIGHT = 600;
const PADDLE_SPEED = 600;      // px/s
const MAX_BOUNCE_ANGLE = 60;   // degrees from vertical
const START_LIVES = 3;
const BLOCK_W = 64, BLOCK_H = 32;  // sprite 32x16 scaled 2x
const GRID_COLS = 10;
const GRID_X = 80, GRID_Y = 60;    // 10 * 64 = 640 -> 80px side margins
const MAX_DT = 0.05;           // s, clamp to avoid tunneling after lag
const MAX_STEP_PX = 8;         // max ball travel per physics sub-step
const BG_COLOR = '#000';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const game = {
  state: 'ready',      // 'ready' | 'playing' | 'paused' | 'gameover' | 'won'
  prevState: null,     // 'ready' | 'playing': state to return to on resume
  pausedAt: 0,         // performance.now() when the pause started
  menu: { screen: 'main', index: 0 },   // screen: 'main' | 'levels'
  level: 1,            // 1..LEVELS.length
  score: 0,
  lives: START_LIVES,
  paddle: { x: (WIDTH - 162) / 2, y: HEIGHT - 40, w: 162, h: 14 },
  ball: { x: WIDTH / 2, y: HEIGHT - 40 - 8, vx: 0, vy: 0, r: 8 },
  blocks: [],          // { x, y, color, hits, points, alive }
  explosions: [],      // { x, y, color, start }  (start = timestamp in ms)
};

let lastTime = 0;

// Ball speed (px/s, constant magnitude) of the active level
function levelSpeed() {
  return LEVELS[game.level - 1].speed;
}

function createBlocks() {
  const blocks = [];
  const rows = LEVELS[game.level - 1].rows;
  for (let row = 0; row < rows.length; row++) {
    for (let col = 0; col < GRID_COLS; col++) {
      const char = rows[row][col];
      if (char === '.') continue;
      const color = LEVEL_CHARS[char];
      if (!color) {
        console.warn('Unknown level char "' + char + '" in level ' + game.level + ', row ' + row);
        continue;
      }
      const isGray = color === 'gray';
      blocks.push({
        x: GRID_X + col * BLOCK_W,
        y: GRID_Y + row * BLOCK_H,
        color,
        hits: isGray ? 2 : 1,
        points: isGray ? 50 : 10,
        alive: true,
      });
    }
  }
  return blocks;
}

game.blocks = createBlocks();

const LAUNCH_SPREAD = 15;      // degrees from vertical, random either side

const bounceSound = new Audio('assets/sounds/ball-bounce.mp3');
const breakSound = new Audio('assets/sounds/break-sound.mp3');

function playSound(sound) {
  sound.currentTime = 0;
  sound.play().catch(() => {});
}

const MENU_ITEMS = ['Resume', 'Restart level', 'Change level', 'Finish game'];

const keys = {};

window.addEventListener('keydown', (e) => {
  keys[e.code] = true;
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'Escape'].includes(e.code)) e.preventDefault();
  if (e.repeat) return;

  if (e.code === 'Escape') {
    if (game.state === 'ready' || game.state === 'playing') pauseGame();
    else if (game.state === 'paused') {
      if (game.menu.screen === 'levels') {
        game.menu.screen = 'main';
        game.menu.index = MENU_ITEMS.indexOf('Change level');
      } else {
        resumeGame();
      }
    }
    return;
  }

  if (game.state === 'paused') {
    handleMenuKey(e.code);
    return;
  }

  // Launch and restart are one-shot actions, so holding the key can't chain them
  if (e.code === 'Space' && game.state === 'ready') {
    launchBall();
  } else if ((e.code === 'Space' || e.code === 'Enter') &&
             (game.state === 'gameover' || game.state === 'won')) {
    resetGame();
  }
});
window.addEventListener('keyup', (e) => {
  keys[e.code] = false;
});

function pauseGame() {
  game.prevState = game.state;
  game.state = 'paused';
  game.pausedAt = performance.now();
  game.menu.screen = 'main';
  game.menu.index = 0;
  // A key released while paused would otherwise stay stuck as held
  for (const code in keys) keys[code] = false;
}

function resumeGame() {
  // Shift explosion timers so their animation continues where it stopped
  const pausedFor = performance.now() - game.pausedAt;
  for (const e of game.explosions) e.start += pausedFor;
  game.state = game.prevState;
  game.prevState = null;
}

function handleMenuKey(code) {
  const menu = game.menu;
  const inLevels = menu.screen === 'levels';
  const count = inLevels ? LEVELS.length : MENU_ITEMS.length;
  if (code === 'ArrowUp') {
    menu.index = (menu.index - 1 + count) % count;
  } else if (code === 'ArrowDown') {
    menu.index = (menu.index + 1) % count;
  } else if (code === 'Enter') {
    if (inLevels) startLevelFresh(menu.index + 1);
    else selectMenuItem(MENU_ITEMS[menu.index]);
  }
}

// Fresh attempt at a level: score and lives back to their start values
function startLevelFresh(level) {
  game.score = 0;
  game.lives = START_LIVES;
  game.prevState = null;
  loadLevel(level);
}

function selectMenuItem(item) {
  if (item === 'Resume') {
    resumeGame();
  } else if (item === 'Restart level') {
    startLevelFresh(game.level);
  } else if (item === 'Change level') {
    game.menu.screen = 'levels';
    game.menu.index = game.level - 1;
  } else if (item === 'Finish game') {
    game.state = 'gameover';
  }
}

function launchBall() {
  const angle = (Math.random() * 2 - 1) * LAUNCH_SPREAD * Math.PI / 180;
  game.ball.vx = levelSpeed() * Math.sin(angle);
  game.ball.vy = -levelSpeed() * Math.cos(angle);
  game.state = 'playing';
}

// Builds the blocks of a level and puts the ball back on the paddle in 'ready'
function loadLevel(level) {
  game.level = level;
  game.blocks = createBlocks();
  game.explosions = [];
  game.paddle.x = (WIDTH - game.paddle.w) / 2;
  game.ball.vx = 0;
  game.ball.vy = 0;
  game.state = 'ready';
}

function resetGame() {
  game.score = 0;
  game.lives = START_LIVES;
  loadLevel(1);
}

function update(dt) {
  if (game.state === 'paused') return;

  const { paddle, ball } = game;

  const now = performance.now();
  game.explosions = game.explosions.filter((e) => now - e.start < EXPLOSION_DURATION);

  let dir = 0;
  if (keys.ArrowLeft || keys.KeyA) dir -= 1;
  if (keys.ArrowRight || keys.KeyD) dir += 1;
  paddle.x += dir * PADDLE_SPEED * dt;
  paddle.x = Math.max(0, Math.min(WIDTH - paddle.w, paddle.x));

  if (game.state === 'ready') {
    ball.x = paddle.x + paddle.w / 2;
    ball.y = paddle.y - ball.r;
  } else if (game.state === 'playing') {
    // Sub-step so a fast ball never moves more than MAX_STEP_PX at once
    const steps = Math.max(1, Math.ceil(Math.hypot(ball.vx, ball.vy) * dt / MAX_STEP_PX));
    for (let i = 0; i < steps && game.state === 'playing'; i++) stepBall(dt / steps);
  }
}

// Moves the ball by dt and resolves wall, paddle, block and floor collisions
function stepBall(dt) {
  const { paddle, ball } = game;

  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;

  if (ball.x - ball.r < 0) {
    ball.x = ball.r;
    ball.vx = Math.abs(ball.vx);
    playSound(bounceSound);
  } else if (ball.x + ball.r > WIDTH) {
    ball.x = WIDTH - ball.r;
    ball.vx = -Math.abs(ball.vx);
    playSound(bounceSound);
  }
  if (ball.y - ball.r < 0) {
    ball.y = ball.r;
    ball.vy = Math.abs(ball.vy);
    playSound(bounceSound);
  }

  if (
    ball.vy > 0 &&
    ball.x + ball.r > paddle.x && ball.x - ball.r < paddle.x + paddle.w &&
    ball.y + ball.r > paddle.y && ball.y - ball.r < paddle.y + paddle.h
  ) {
    // -1 at the left edge, 0 at the center, 1 at the right edge
    const hit = (ball.x - (paddle.x + paddle.w / 2)) / (paddle.w / 2);
    const angle = Math.max(-1, Math.min(1, hit)) * MAX_BOUNCE_ANGLE * Math.PI / 180;
    ball.vx = levelSpeed() * Math.sin(angle);
    ball.vy = -levelSpeed() * Math.cos(angle);
    ball.y = paddle.y - ball.r;
    playSound(bounceSound);
  }

  if (ball.y - ball.r > HEIGHT) {
    game.lives -= 1;
    ball.vx = 0;
    ball.vy = 0;
    game.state = game.lives > 0 ? 'ready' : 'gameover';
    return;
  }

  for (const b of game.blocks) {
    if (!b.alive) continue;
    const overlapLeft = ball.x + ball.r - b.x;
    const overlapRight = b.x + BLOCK_W - (ball.x - ball.r);
    const overlapTop = ball.y + ball.r - b.y;
    const overlapBottom = b.y + BLOCK_H - (ball.y - ball.r);
    if (overlapLeft <= 0 || overlapRight <= 0 || overlapTop <= 0 || overlapBottom <= 0) continue;

    // Resolve along the axis with the smallest penetration
    const minX = Math.min(overlapLeft, overlapRight);
    const minY = Math.min(overlapTop, overlapBottom);
    if (minX < minY) {
      if (overlapLeft < overlapRight) {
        ball.x -= overlapLeft;
        ball.vx = -Math.abs(ball.vx);
      } else {
        ball.x += overlapRight;
        ball.vx = Math.abs(ball.vx);
      }
    } else if (overlapTop < overlapBottom) {
      ball.y -= overlapTop;
      ball.vy = -Math.abs(ball.vy);
    } else {
      ball.y += overlapBottom;
      ball.vy = Math.abs(ball.vy);
    }

    b.hits -= 1;
    if (b.hits <= 0) {
      b.alive = false;
      game.score += b.points;
      playSound(breakSound);
      game.explosions.push({ x: b.x, y: b.y, color: b.color, start: performance.now() });
      if (!game.blocks.some((other) => other.alive)) {
        if (game.level < LEVELS.length) loadLevel(game.level + 1);
        else game.state = 'won';
      }
    } else {
      playSound(bounceSound);
    }
    break; // one block per frame
  }
}

function draw() {
  ctx.fillStyle = BG_COLOR;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  for (const b of game.blocks) {
    if (b.alive) drawSprite(ctx, 'block_' + b.color, b.x, b.y, BLOCK_W, BLOCK_H);
  }

  const now = game.state === 'paused' ? game.pausedAt : performance.now();
  for (const e of game.explosions) {
    const frames = EXPLOSION_FRAMES[e.color];
    const i = Math.min(frames.length - 1, Math.floor((now - e.start) / EXPLOSION_DURATION * frames.length));
    drawFrame(ctx, frames[i], e.x, e.y, BLOCK_W, BLOCK_H);
  }

  const { paddle, ball } = game;
  drawSprite(ctx, 'paddle', paddle.x, paddle.y, paddle.w, paddle.h);
  drawSprite(ctx, 'ball', ball.x - ball.r, ball.y - ball.r, ball.r * 2, ball.r * 2);

  ctx.fillStyle = '#fff';
  ctx.font = '20px monospace';
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.fillText('Score: ' + game.score, 16, 16);
  ctx.textAlign = 'center';
  ctx.fillText('Level ' + game.level, WIDTH / 2, 16);
  ctx.textAlign = 'right';
  ctx.fillText('Lives: ' + game.lives, WIDTH - 16, 16);

  if (game.state === 'paused') {
    drawPauseMenu();
  } else if (game.state === 'gameover' || game.state === 'won') {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '48px monospace';
    ctx.fillText(game.state === 'won' ? 'YOU WIN!' : 'GAME OVER', WIDTH / 2, HEIGHT / 2 - 20);
    ctx.font = '20px monospace';
    ctx.fillText('Press Space or Enter to play again', WIDTH / 2, HEIGHT / 2 + 30);
  }
}

function drawPauseMenu() {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff';
  ctx.font = '48px monospace';
  const inLevels = game.menu.screen === 'levels';
  ctx.fillText(inLevels ? 'SELECT LEVEL' : 'PAUSED', WIDTH / 2, 150);
  const labels = inLevels ? LEVELS.map((_, i) => 'Level ' + (i + 1)) : MENU_ITEMS;
  const spacing = inLevels ? 40 : 50;
  ctx.font = '28px monospace';
  labels.forEach((label, i) => {
    const selected = i === game.menu.index;
    ctx.fillStyle = selected ? '#ff0' : '#aaa';
    ctx.fillText((selected ? '> ' : '  ') + label + (selected ? ' <' : '  '), WIDTH / 2, 230 + i * spacing);
  });
}

function frame(now) {
  const dt = Math.min((now - lastTime) / 1000, MAX_DT);
  lastTime = now;
  update(dt);
  draw();
  requestAnimationFrame(frame);
}

loadSpritesheet(() => {
  requestAnimationFrame((now) => {
    lastTime = now;
    requestAnimationFrame(frame);
  });
});
