'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#90caf9', // J - pale blue
  '#ffb74d', // L - orange
];

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
];

const LINE_SCORES = [0, 100, 300, 500, 800];

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const pauseMenu = document.getElementById('pause-menu');
const resumeBtn = document.getElementById('resume-btn');
const pauseRestartBtn = document.getElementById('pause-restart-btn');
const controlsBtn = document.getElementById('controls-btn');
const controlsList = document.getElementById('controls-list');
const startLevelSelect = document.getElementById('start-level');
const startBtn = document.getElementById('start-btn');
const nameForm = document.getElementById('name-form');
const nameInput = document.getElementById('name-input');
const recordsBox = document.getElementById('records');
const recordsList = document.getElementById('records-list');
const recordsStats = document.getElementById('records-stats');
const resetRecordsBtn = document.getElementById('reset-records-btn');

const RECORDS_KEY = 'tetris-records';
const MAX_RECORDS = 5;
const themeToggle = document.getElementById('theme-toggle');
const skinSelect = document.getElementById('skin-select');

let gridColor = '#22222e';
let ghostAlpha = 0.2;

let startLevel = 1;
let started = false, comboCount = 0, bestCombo = 0, pendingEntry = null, highlightIndex = -1;
let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.floor(Math.random() * 7) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    comboCount++;
    bestCombo = Math.max(bestCombo, comboCount);
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = startLevel + Math.floor(lines / 10);
    dropInterval = intervalForLevel(level);
    updateHUD();
  } else {
    comboCount = 0;
  }
}

function intervalForLevel(lvl) {
  return Math.max(100, 1000 - (lvl - 1) * 90);
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  merge();
  clearLines();
  spawn();
}

function spawn() {
  current = next;
  next = randomPiece();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

// Cada skin define su paleta (índices 1–7, igual que PIECES) y su función de dibujo de bloque.
// Las funciones reciben el contexto, la esquina (px, py) en píxeles, el tamaño y el color.
const SKINS = {
  retro: {
    colors: COLORS,
    draw(context, px, py, size, color) {
      context.fillStyle = color;
      context.fillRect(px + 1, py + 1, size - 2, size - 2);
      context.fillStyle = 'rgba(255,255,255,0.12)';
      context.fillRect(px + 1, py + 1, size - 2, 4);
    },
  },
  neon: {
    colors: [null, '#00f0ff', '#ffe600', '#d500f9', '#39ff14', '#ff1744', '#448aff', '#ff9100'],
    draw(context, px, py, size, color) {
      context.shadowColor = color;
      context.shadowBlur = 12;
      context.fillStyle = 'rgba(0,0,0,0.85)';
      context.fillRect(px + 3, py + 3, size - 6, size - 6);
      context.strokeStyle = color;
      context.lineWidth = 2;
      context.strokeRect(px + 3, py + 3, size - 6, size - 6);
      context.shadowBlur = 0;
      context.fillStyle = color;
      context.globalAlpha *= 0.35;
      context.fillRect(px + 6, py + 6, size - 12, size - 12);
    },
  },
  pastel: {
    colors: [null, '#a8e6ef', '#fff1b3', '#d7bde2', '#b9e6c1', '#f7b9b9', '#b5d3f5', '#ffd3a8'],
    draw(context, px, py, size, color) {
      const r = size * 0.28;
      context.fillStyle = color;
      context.beginPath();
      if (context.roundRect) context.roundRect(px + 2, py + 2, size - 4, size - 4, r);
      else context.rect(px + 2, py + 2, size - 4, size - 4);
      context.fill();
      context.fillStyle = 'rgba(255,255,255,0.45)';
      context.beginPath();
      if (context.roundRect) context.roundRect(px + 6, py + 5, size - 12, size * 0.18, size * 0.09);
      else context.rect(px + 6, py + 5, size - 12, size * 0.18);
      context.fill();
    },
  },
  pixel: {
    colors: [null, '#29b6f6', '#fdd835', '#ab47bc', '#66bb6a', '#ef5350', '#5c6bc0', '#ff9800'],
    draw(context, px, py, size, color) {
      const p = Math.floor(size / 6); // «píxel» de la textura
      const inner = p * 6;
      const ox = px + Math.floor((size - inner) / 2);
      const oy = py + Math.floor((size - inner) / 2);
      context.fillStyle = color;
      context.fillRect(ox, oy, inner, inner);
      // sombra (abajo/derecha), luz (arriba/izquierda) y trama de ajedrez en el centro
      context.fillStyle = 'rgba(0,0,0,0.35)';
      context.fillRect(ox, oy + inner - p, inner, p);
      context.fillRect(ox + inner - p, oy, p, inner);
      context.fillStyle = 'rgba(255,255,255,0.4)';
      context.fillRect(ox, oy, inner - p, p);
      context.fillRect(ox, oy, p, inner - p);
      for (let i = 1; i < 5; i++)
        for (let j = 1; j < 5; j++)
          if ((i + j) % 2 === 0) {
            context.fillStyle = 'rgba(0,0,0,0.12)';
            context.fillRect(ox + i * p, oy + j * p, p, p);
          }
      context.fillStyle = 'rgba(255,255,255,0.55)';
      context.fillRect(ox + p, oy + p, p, p);
    },
  },
};

const SKIN_KEY = 'tetris-skin';
let skin = 'retro';

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const s = SKINS[skin];
  context.save();
  context.globalAlpha = alpha ?? 1;
  s.draw(context, x * size, y * size, size, s.colors[colorIndex]);
  context.restore();
}

function drawGrid() {
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, ghostAlpha);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function loadRecords() {
  const empty = { scores: [], bestCombo: 0, maxLines: 0 };
  try {
    const data = JSON.parse(localStorage.getItem(RECORDS_KEY));
    if (data && Array.isArray(data.scores)) {
      return {
        scores: data.scores.filter(s => s && Number.isFinite(s.score)).slice(0, MAX_RECORDS),
        bestCombo: Number(data.bestCombo) || 0,
        maxLines: Number(data.maxLines) || 0,
      };
    }
  } catch (e) { /* localStorage no disponible o JSON corrupto */ }
  return empty;
}

function saveRecords(data) {
  try { localStorage.setItem(RECORDS_KEY, JSON.stringify(data)); } catch (e) { /* ignorar */ }
}

function qualifies(data, s) {
  return s > 0 && (data.scores.length < MAX_RECORDS || s > data.scores[data.scores.length - 1].score);
}

function renderRecords() {
  const data = loadRecords();
  recordsList.replaceChildren();
  for (let i = 0; i < MAX_RECORDS; i++) {
    const entry = data.scores[i];
    const li = document.createElement('li');
    const left = document.createElement('span');
    const right = document.createElement('span');
    left.textContent = `${i + 1}. ${entry ? entry.name : '---'}`;
    right.textContent = entry ? entry.score.toLocaleString() : '';
    li.append(left, right);
    if (entry && i === highlightIndex) li.classList.add('highlight');
    recordsList.append(li);
  }
  recordsStats.textContent = `Mejor combo: ${data.bestCombo} · Líneas máx.: ${data.maxLines}`;
}

function showRecords() {
  renderRecords();
  recordsBox.classList.remove('hidden');
}

function submitName(e) {
  e.preventDefault();
  if (!pendingEntry) return;
  const data = loadRecords();
  const entry = { name: nameInput.value.trim() || 'Jugador', score: pendingEntry.score };
  // a igualdad de puntos, la nueva entrada queda detrás de las existentes
  let pos = data.scores.findIndex(s => s.score < entry.score);
  if (pos === -1) pos = data.scores.length;
  data.scores.splice(pos, 0, entry);
  data.scores = data.scores.slice(0, MAX_RECORDS);
  saveRecords(data);
  highlightIndex = pos;
  pendingEntry = null;
  nameForm.classList.add('hidden');
  renderRecords();
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  const data = loadRecords();
  data.bestCombo = Math.max(data.bestCombo, bestCombo);
  data.maxLines = Math.max(data.maxLines, lines);
  const isRecord = qualifies(data, score);
  saveRecords(data);
  pendingEntry = isRecord ? { score } : null;
  highlightIndex = -1;
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  startBtn.classList.add('hidden');
  restartBtn.classList.remove('hidden');
  pauseMenu.classList.add('hidden');
  nameForm.classList.toggle('hidden', !isRecord);
  nameInput.value = '';
  showRecords();
  overlay.classList.remove('hidden');
  if (isRecord) nameInput.focus();
  else restartBtn.focus();
}

function showStart() {
  overlayTitle.textContent = 'TETRIS';
  overlayScore.textContent = '';
  startBtn.classList.remove('hidden');
  restartBtn.classList.add('hidden');
  pauseMenu.classList.add('hidden');
  nameForm.classList.add('hidden');
  highlightIndex = -1;
  showRecords();
  overlay.classList.remove('hidden');
  startBtn.focus();
}

function startGame() {
  started = true;
  init();
}

function togglePause() {
  if (gameOver || !started) return;
  paused = !paused;
  if (!paused) {
    overlay.classList.add('hidden');
    // evita que un botón del menú conserve el foco y capture Space al volver al juego
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    startBtn.classList.add('hidden');
    restartBtn.classList.add('hidden');
    nameForm.classList.add('hidden');
    recordsBox.classList.add('hidden');
    pauseMenu.classList.remove('hidden');
    setControlsOpen(false);
    overlay.classList.remove('hidden');
    resumeBtn.focus();
  }
}

function setControlsOpen(open) {
  controlsList.classList.toggle('hidden', !open);
  controlsBtn.setAttribute('aria-expanded', String(open));
  controlsBtn.textContent = open ? 'Ocultar controles' : 'Ver controles';
}

function loop(ts) {
  if (gameOver || paused) return;
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  draw();
  // endGame() puede dispararse desde lockPiece() dentro de este mismo frame;
  // su cancelAnimationFrame no detiene el frame en curso, así que no reprogramamos
  if (gameOver) return;
  animId = requestAnimationFrame(loop);
}

function applyTheme(theme) {
  const light = theme === 'light';
  document.documentElement.dataset.theme = theme;
  themeToggle.setAttribute('aria-checked', String(light));
  themeToggle.textContent = light ? '🌙 Tema oscuro' : '☀ Tema claro';
  themeToggle.setAttribute('aria-label', light ? 'Tema oscuro' : 'Tema claro');
  refreshCanvasColors();
}

function refreshCanvasColors() {
  // los colores del canvas se cachean aquí para no leer estilos en cada frame
  const styles = getComputedStyle(document.documentElement);
  gridColor = styles.getPropertyValue('--grid').trim();
  ghostAlpha = parseFloat(styles.getPropertyValue('--ghost-alpha'));
  // repinta aunque el juego esté en pausa o terminado
  if (current) draw();
}

function applySkin(name) {
  if (!SKINS[name]) name = 'retro';
  skin = name;
  document.documentElement.dataset.skin = name;
  skinSelect.value = name;
  try { localStorage.setItem(SKIN_KEY, name); } catch (e) { /* ignorar */ }
  refreshCanvasColors();
  if (next) drawNext();
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = startLevel;
  paused = false;
  gameOver = false;
  dropInterval = intervalForLevel(level);
  comboCount = 0;
  bestCombo = 0;
  pendingEntry = null;
  dropAccum = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  // al escribir el nombre, las teclas no deben llegar al juego
  if (e.target instanceof HTMLInputElement) return;
  // con un selector enfocado, las flechas cambian la opción, no mueven la pieza;
  // pausa/reanudar sí debe funcionar (p. ej. con «Nivel inicial» enfocado en el menú)
  if (e.target instanceof HTMLSelectElement && e.code !== 'KeyP' && e.code !== 'Escape') return;
  // Space sobre un botón enfocado lo activa; no debe además provocar una caída dura
  if (e.code === 'Space' && e.target instanceof HTMLButtonElement) return;
  if (e.code === 'KeyP' || e.code === 'Escape') { togglePause(); return; }
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', init);
pauseRestartBtn.addEventListener('click', init);
resumeBtn.addEventListener('click', togglePause);
controlsBtn.addEventListener('click', () => setControlsOpen(controlsList.classList.contains('hidden')));
startLevelSelect.addEventListener('change', () => {
  startLevel = parseInt(startLevelSelect.value, 10);
});
startBtn.addEventListener('click', startGame);
nameForm.addEventListener('submit', submitName);
resetRecordsBtn.addEventListener('click', () => {
  if (!confirm('¿Borrar todos los records?')) return;
  saveRecords({ scores: [], bestCombo: 0, maxLines: 0 });
  highlightIndex = -1;
  renderRecords();
});
themeToggle.addEventListener('click', () => {
  applyTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light');
});

skinSelect.addEventListener('change', () => {
  applySkin(skinSelect.value);
  skinSelect.blur(); // devuelve el control del teclado al juego
});

let savedSkin = null;
try { savedSkin = localStorage.getItem(SKIN_KEY); } catch (e) { /* ignorar */ }
applyTheme('dark');
init();
applySkin(savedSkin);
// pantalla de inicio: el juego queda parado hasta pulsar «Jugar»
cancelAnimationFrame(animId);
paused = true;
showStart();
