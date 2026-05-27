'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;
const MAX_START_LEVEL = 15;
const RECORDS_LIMIT = 5;

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                              // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
  [[8,8,8],[8,0,8],[8,8,8]],                  // N (tuerca)
];

const LINE_SCORES = [0, 100, 300, 500, 800];

const SKINS = {
  retro: {
    label: 'Retro',
    bg: '#1a1a25',
    grid: '#22222e',
    colors: [null, '#4dd0e1', '#ffd54f', '#ba68c8', '#81c784', '#e57373', '#90caf9', '#ffb74d', '#9e9e9e'],
    draw: drawBlockRetro,
  },
  neon: {
    label: 'Neon',
    bg: '#05050a',
    grid: '#0a0a18',
    colors: [null, '#00f0ff', '#fff200', '#ff00ff', '#00ff84', '#ff2a6d', '#3a86ff', '#ff8500', '#b388ff'],
    draw: drawBlockNeon,
  },
  pastel: {
    label: 'Pastel',
    bg: '#fdf6f0',
    grid: '#ecdfd5',
    colors: [null, '#a8e6cf', '#fff3b0', '#dcc6f7', '#c8f7c5', '#ffb3ba', '#bae1ff', '#ffd8a8', '#d8c9b8'],
    draw: drawBlockPastel,
  },
  pixelart: {
    label: 'Pixel art',
    bg: '#1a1a25',
    grid: '#2b2b40',
    colors: [null, '#4dd0e1', '#ffd54f', '#ba68c8', '#81c784', '#e57373', '#90caf9', '#ffb74d', '#9e9e9e'],
    draw: drawBlockPixelArt,
  },
};

const STORAGE = {
  theme: 'tetris-theme',
  skin: 'tetris-skin',
  startLevel: 'tetris-start-level',
  records: 'tetris-records-v1',
};

// ---- DOM ----
const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const holdCanvas = document.getElementById('hold-canvas');
const holdCtx = holdCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const screens = {
  start: document.getElementById('screen-start'),
  pause: document.getElementById('screen-pause'),
  gameover: document.getElementById('screen-gameover'),
};
const recordsStart = document.getElementById('records-start');
const recordsGameover = document.getElementById('records-gameover');
const statsStart = document.getElementById('stats-start');
const statsGameover = document.getElementById('stats-gameover');
const levelSelectStart = document.getElementById('level-select-start');
const levelSelectPause = document.getElementById('level-select-pause');
const skinSelectStart = document.getElementById('skin-select-start');
const skinSelectPause = document.getElementById('skin-select-pause');
const pauseControls = document.getElementById('pause-controls');
const nameInputRow = document.getElementById('name-input-row');
const playerNameInput = document.getElementById('player-name');
const finalScoreEl = document.getElementById('final-score');

// ---- State ----
let board, current, next, held, holdLocked;
let score, lines, level, paused, gameOver;
let lastTime, dropAccum, dropInterval, animId;
let startLevel, skin, combo, maxComboSession, pendingHighScore;
let activeScreen = null;

// ---- Skin draw functions ----

function drawBlockRetro(context, x, y, idx, size, alpha, colors) {
  context.globalAlpha = alpha;
  context.fillStyle = colors[idx];
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  context.fillStyle = 'rgba(255,255,255,0.12)';
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  context.globalAlpha = 1;
}

function drawBlockNeon(context, x, y, idx, size, alpha, colors) {
  const color = colors[idx];
  context.save();
  context.globalAlpha = alpha;
  context.shadowColor = color;
  context.shadowBlur = 14;
  context.fillStyle = color;
  context.fillRect(x * size + 3, y * size + 3, size - 6, size - 6);
  context.shadowBlur = 0;
  context.strokeStyle = '#ffffff';
  context.lineWidth = 1;
  context.strokeRect(x * size + 3.5, y * size + 3.5, size - 7, size - 7);
  context.restore();
}

function drawBlockPastel(context, x, y, idx, size, alpha, colors) {
  const px = x * size + 2;
  const py = y * size + 2;
  const s = size - 4;
  const r = Math.min(8, s / 3);
  context.save();
  context.globalAlpha = alpha;
  context.fillStyle = colors[idx];
  context.beginPath();
  context.moveTo(px + r, py);
  context.lineTo(px + s - r, py);
  context.quadraticCurveTo(px + s, py, px + s, py + r);
  context.lineTo(px + s, py + s - r);
  context.quadraticCurveTo(px + s, py + s, px + s - r, py + s);
  context.lineTo(px + r, py + s);
  context.quadraticCurveTo(px, py + s, px, py + s - r);
  context.lineTo(px, py + r);
  context.quadraticCurveTo(px, py, px + r, py);
  context.closePath();
  context.fill();
  context.fillStyle = 'rgba(255,255,255,0.5)';
  context.fillRect(px + 4, py + 4, s - 8, 3);
  context.restore();
}

function drawBlockPixelArt(context, x, y, idx, size, alpha, colors) {
  const color = colors[idx];
  const px = x * size + 1;
  const py = y * size + 1;
  const s = size - 2;
  context.save();
  context.globalAlpha = alpha;
  context.fillStyle = color;
  context.fillRect(px, py, s, s);
  const lighter = shadeColor(color, 30);
  const darker = shadeColor(color, -40);
  const u = Math.max(2, Math.floor(s / 6));
  context.fillStyle = lighter;
  context.fillRect(px, py, s, u);
  context.fillRect(px, py, u, s);
  context.fillStyle = darker;
  context.fillRect(px, py + s - u, s, u);
  context.fillRect(px + s - u, py, u, s);
  context.fillStyle = lighter;
  context.fillRect(px + u + 1, py + u + 1, u, u);
  context.fillStyle = darker;
  context.fillRect(px + s - u * 2 - 1, py + s - u * 2 - 1, u, u);
  context.restore();
}

function shadeColor(hex, percent) {
  const c = hex.replace('#', '');
  const num = parseInt(c, 16);
  let r = (num >> 16) + percent;
  let g = ((num >> 8) & 0xff) + percent;
  let b = (num & 0xff) + percent;
  r = Math.max(0, Math.min(255, r));
  g = Math.max(0, Math.min(255, g));
  b = Math.max(0, Math.min(255, b));
  return `rgb(${r}, ${g}, ${b})`;
}

function drawBlock(context, x, y, idx, size, alpha = 1) {
  if (!idx) return;
  const s = SKINS[skin];
  s.draw(context, x, y, idx, size, alpha, s.colors);
}

// ---- Game logic ----

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function createPiece(type) {
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function randomPiece() {
  const type = Math.floor(Math.random() * 8) + 1;
  return createPiece(type);
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
  for (const kick of [0, -1, 1, -2, 2]) {
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
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.floor(lines / 10) + startLevel;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    combo++;
    if (combo > maxComboSession) maxComboSession = combo;
    if (combo > 0) score += 50 * combo * level;
    updateHUD();
  } else {
    combo = -1;
  }
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
  holdLocked = false;
  if (collide(current.shape, current.x, current.y)) {
    endGame();
    return;
  }
  drawNext();
  drawHold();
}

function tryHold() {
  if (gameOver || paused || holdLocked) return;
  const currentType = current.type;
  if (held === null) {
    held = currentType;
    current = next;
    next = randomPiece();
    drawNext();
  } else {
    const swapType = held;
    held = currentType;
    current = createPiece(swapType);
  }
  holdLocked = true;
  drawHold();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

// ---- Render ----

function fillBg(context, w, h) {
  context.fillStyle = SKINS[skin].bg;
  context.fillRect(0, 0, w, h);
}

function drawGrid() {
  ctx.strokeStyle = SKINS[skin].grid;
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
  fillBg(ctx, canvas.width, canvas.height);
  drawGrid();
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);
  if (!current) return;
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
}

function drawNext() {
  const NB = 30;
  fillBg(nextCtx, nextCanvas.width, nextCanvas.height);
  if (!next) return;
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function drawHold() {
  const NB = 30;
  fillBg(holdCtx, holdCanvas.width, holdCanvas.height);
  if (held === null) return;
  const shape = PIECES[held];
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  const alpha = holdLocked ? 0.35 : 1;
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(holdCtx, offX + c, offY + r, shape[r][c], NB, alpha);
}

// ---- Records ----

function loadRecords() {
  try {
    const raw = localStorage.getItem(STORAGE.records);
    if (!raw) return { top: [], bestCombo: 0, maxLines: 0 };
    const data = JSON.parse(raw);
    return {
      top: Array.isArray(data.top) ? data.top : [],
      bestCombo: data.bestCombo || 0,
      maxLines: data.maxLines || 0,
    };
  } catch {
    return { top: [], bestCombo: 0, maxLines: 0 };
  }
}

function saveRecords(records) {
  localStorage.setItem(STORAGE.records, JSON.stringify(records));
}

function isHighScore(s) {
  if (s <= 0) return false;
  const r = loadRecords();
  if (r.top.length < RECORDS_LIMIT) return true;
  return s > r.top[r.top.length - 1].score;
}

function addHighScore(name, s, ln, lv) {
  const r = loadRecords();
  r.top.push({
    name: (name || 'ANON').toUpperCase().slice(0, 12) || 'ANON',
    score: s, lines: ln, level: lv, date: Date.now(),
  });
  r.top.sort((a, b) => b.score - a.score);
  r.top = r.top.slice(0, RECORDS_LIMIT);
  saveRecords(r);
}

function updateSessionRecords() {
  const r = loadRecords();
  let dirty = false;
  if (maxComboSession > r.bestCombo) { r.bestCombo = maxComboSession; dirty = true; }
  if (lines > r.maxLines) { r.maxLines = lines; dirty = true; }
  if (dirty) saveRecords(r);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function renderRecords(container, statsContainer, highlightScore = null) {
  const r = loadRecords();
  container.innerHTML = '';
  if (!r.top.length) {
    const empty = document.createElement('p');
    empty.className = 'records-empty';
    empty.textContent = 'Aún no hay records';
    container.appendChild(empty);
  } else {
    const list = document.createElement('ol');
    list.className = 'records-ol';
    r.top.forEach((entry, i) => {
      const li = document.createElement('li');
      li.className = 'records-row';
      if (highlightScore !== null && entry.score === highlightScore) li.classList.add('highlight');
      li.innerHTML = `
        <span class="records-rank">${i + 1}.</span>
        <span class="records-name">${escapeHtml(entry.name)}</span>
        <span class="records-score">${entry.score.toLocaleString()}</span>
      `;
      list.appendChild(li);
    });
    container.appendChild(list);
  }
  if (statsContainer) {
    statsContainer.innerHTML = `
      <span>Combo máx: <b>${r.bestCombo}</b></span>
      <span>Líneas máx: <b>${r.maxLines}</b></span>
    `;
  }
}

function resetRecords() {
  if (!confirm('¿Borrar todos los records?')) return;
  localStorage.removeItem(STORAGE.records);
  pendingHighScore = null;
  refreshRecordsViews();
}

function refreshRecordsViews() {
  renderRecords(recordsStart, statsStart);
  renderRecords(recordsGameover, statsGameover, pendingHighScore);
}

// ---- Screens ----

function showScreen(name) {
  activeScreen = name;
  if (name === null) {
    overlay.classList.add('hidden');
    Object.values(screens).forEach(s => s.classList.add('hidden'));
    return;
  }
  overlay.classList.remove('hidden');
  Object.entries(screens).forEach(([key, el]) => el.classList.toggle('hidden', key !== name));
  if (name === 'pause') {
    pauseControls.classList.add('hidden');
    const toggleBtn = screens.pause.querySelector('[data-action="toggle-controls"]');
    toggleBtn.setAttribute('aria-expanded', 'false');
  }
}

function populateLevelSelects() {
  [levelSelectStart, levelSelectPause].forEach(sel => {
    sel.innerHTML = '';
    for (let i = 1; i <= MAX_START_LEVEL; i++) {
      const opt = document.createElement('option');
      opt.value = i;
      opt.textContent = i;
      sel.appendChild(opt);
    }
    sel.value = startLevel;
  });
}

function populateSkinSelects() {
  [skinSelectStart, skinSelectPause].forEach(sel => {
    sel.innerHTML = '';
    Object.entries(SKINS).forEach(([key, def]) => {
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = def.label;
      sel.appendChild(opt);
    });
    sel.value = skin;
  });
}

function setSkin(name) {
  if (!SKINS[name]) return;
  skin = name;
  localStorage.setItem(STORAGE.skin, skin);
  document.body.dataset.skin = skin;
  skinSelectStart.value = skin;
  skinSelectPause.value = skin;
  draw();
  drawNext();
  drawHold();
}

function setStartLevel(n) {
  startLevel = Math.max(1, Math.min(MAX_START_LEVEL, Number(n) || 1));
  localStorage.setItem(STORAGE.startLevel, startLevel);
  levelSelectStart.value = startLevel;
  levelSelectPause.value = startLevel;
}

// ---- Game flow ----

function startGame() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = startLevel;
  paused = false;
  gameOver = false;
  held = null;
  holdLocked = false;
  combo = -1;
  maxComboSession = 0;
  pendingHighScore = null;
  dropInterval = Math.max(100, 1000 - (startLevel - 1) * 90);
  dropAccum = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  showScreen(null);
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  updateSessionRecords();
  const high = isHighScore(score);
  pendingHighScore = high ? score : null;
  finalScoreEl.textContent = `Puntuación: ${score.toLocaleString()} · Líneas: ${lines} · Nivel: ${level}`;
  nameInputRow.classList.toggle('hidden', !high);
  if (high) {
    playerNameInput.value = '';
    setTimeout(() => playerNameInput.focus(), 50);
  }
  refreshRecordsViews();
  showScreen('gameover');
}

function pauseGame() {
  if (gameOver || paused) return;
  paused = true;
  cancelAnimationFrame(animId);
  showScreen('pause');
}

function resumeGame() {
  if (gameOver || !paused) return;
  paused = false;
  showScreen(null);
  lastTime = performance.now();
  animId = requestAnimationFrame(loop);
}

function togglePause() {
  if (gameOver) return;
  if (activeScreen === 'start' || activeScreen === 'gameover') return;
  if (paused) resumeGame();
  else pauseGame();
}

function backToStart() {
  paused = false;
  gameOver = true;
  cancelAnimationFrame(animId);
  board = createBoard();
  current = null;
  next = null;
  held = null;
  draw();
  drawNext();
  drawHold();
  refreshRecordsViews();
  showScreen('start');
}

function loop(ts) {
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
  if (gameOver) return;
  draw();
  animId = requestAnimationFrame(loop);
}

// ---- Input ----

const GAME_KEYS = new Set([
  'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
  'Space', 'KeyX', 'KeyP', 'KeyC', 'ShiftLeft', 'ShiftRight', 'Escape',
]);

document.addEventListener('keydown', e => {
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT')) return;
  if (GAME_KEYS.has(e.code)) e.preventDefault();

  if (e.code === 'KeyP' || e.code === 'Escape') {
    togglePause();
    return;
  }

  if (activeScreen !== null || paused || gameOver) return;

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
      hardDrop();
      break;
    case 'KeyC':
    case 'ShiftLeft':
    case 'ShiftRight':
      tryHold();
      break;
  }
  updateHUD();
});

overlay.addEventListener('click', e => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const action = btn.dataset.action;
  switch (action) {
    case 'play':
    case 'restart':
      startGame();
      break;
    case 'resume':
      resumeGame();
      break;
    case 'toggle-controls': {
      const isHidden = pauseControls.classList.toggle('hidden');
      btn.setAttribute('aria-expanded', String(!isHidden));
      break;
    }
    case 'reset-records':
      resetRecords();
      break;
    case 'save-score':
      addHighScore(playerNameInput.value, score, lines, level);
      pendingHighScore = null;
      nameInputRow.classList.add('hidden');
      refreshRecordsViews();
      break;
    case 'back-to-start':
      backToStart();
      break;
  }
});

[levelSelectStart, levelSelectPause].forEach(sel => {
  sel.addEventListener('change', e => setStartLevel(e.target.value));
});

[skinSelectStart, skinSelectPause].forEach(sel => {
  sel.addEventListener('change', e => setSkin(e.target.value));
});

playerNameInput.addEventListener('keydown', e => {
  if (e.code === 'Enter') {
    e.preventDefault();
    screens.gameover.querySelector('[data-action="save-score"]').click();
  }
});

// ---- Theme toggle (dark/light) ----

const themeToggle = document.getElementById('theme-toggle');
const toggleIcon = themeToggle.querySelector('.toggle-icon');
const toggleLabel = themeToggle.querySelector('.toggle-label');

function applyTheme(isLight) {
  document.body.classList.toggle('light-mode', isLight);
  toggleIcon.textContent = isLight ? '☀' : '☾';
  toggleLabel.textContent = isLight ? 'DARK' : 'LIGHT';
}

applyTheme(localStorage.getItem(STORAGE.theme) === 'light');

themeToggle.addEventListener('click', () => {
  const isLight = !document.body.classList.contains('light-mode');
  applyTheme(isLight);
  localStorage.setItem(STORAGE.theme, isLight ? 'light' : 'dark');
});

// ---- Boot ----

function boot() {
  startLevel = Number(localStorage.getItem(STORAGE.startLevel)) || 1;
  startLevel = Math.max(1, Math.min(MAX_START_LEVEL, startLevel));
  skin = localStorage.getItem(STORAGE.skin) || 'retro';
  if (!SKINS[skin]) skin = 'retro';
  document.body.dataset.skin = skin;
  board = createBoard();
  populateLevelSelects();
  populateSkinSelects();
  refreshRecordsViews();
  draw();
  drawNext();
  drawHold();
  showScreen('start');
}

boot();
