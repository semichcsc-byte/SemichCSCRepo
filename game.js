/* ============================================================
   MODERN TETRIS — game.js
   Pure JavaScript / Canvas 2D — no dependencies
   ============================================================ */

'use strict';

// ============================================================
// CONSTANTS
// ============================================================
const COLS         = 10;
const VISIBLE_ROWS = 20;
const BUFFER_ROWS  = 2;          // hidden rows above visible field
const BOARD_ROWS   = VISIBLE_ROWS + BUFFER_ROWS;
const CELL         = 30;         // logical px per cell

const LOCK_DELAY_MS   = 500;
const LOCK_MOVE_LIMIT = 15;
const SOFT_DROP_MULT  = 20;      // gravity multiplier for soft drop
const DAS_DELAY_MS    = 167;
const ARR_MS          = 33;

const LINES_PER_LEVEL = 10;
const MAX_LEVEL       = 20;

// ms per gravity tick per level (1-indexed, level 1 = index 0)
const GRAVITY_TABLE = [
  800, 717, 633, 550, 467, 383, 300, 217, 133, 100,
   83,  83,  83,  67,  67,  67,  50,  50,  50,  33,
];

// ============================================================
// TETROMINO SHAPES  (4 rotation states × [dr,dc] from top-left of bounding box)
// ============================================================
const TETROMINOES = {
  I: {
    colorVar: '--color-I',
    // 4×4 bounding box
    states: [
      [[1,0],[1,1],[1,2],[1,3]],
      [[0,2],[1,2],[2,2],[3,2]],
      [[2,0],[2,1],[2,2],[2,3]],
      [[0,1],[1,1],[2,1],[3,1]],
    ],
  },
  O: {
    colorVar: '--color-O',
    states: [
      [[0,1],[0,2],[1,1],[1,2]],
      [[0,1],[0,2],[1,1],[1,2]],
      [[0,1],[0,2],[1,1],[1,2]],
      [[0,1],[0,2],[1,1],[1,2]],
    ],
  },
  T: {
    colorVar: '--color-T',
    states: [
      [[0,1],[1,0],[1,1],[1,2]],
      [[0,1],[1,1],[1,2],[2,1]],
      [[1,0],[1,1],[1,2],[2,1]],
      [[0,1],[1,0],[1,1],[2,1]],
    ],
  },
  S: {
    colorVar: '--color-S',
    states: [
      [[0,1],[0,2],[1,0],[1,1]],
      [[0,1],[1,1],[1,2],[2,2]],
      [[1,1],[1,2],[2,0],[2,1]],
      [[0,0],[1,0],[1,1],[2,1]],
    ],
  },
  Z: {
    colorVar: '--color-Z',
    states: [
      [[0,0],[0,1],[1,1],[1,2]],
      [[0,2],[1,1],[1,2],[2,1]],
      [[1,0],[1,1],[2,1],[2,2]],
      [[0,1],[1,0],[1,1],[2,0]],
    ],
  },
  J: {
    colorVar: '--color-J',
    states: [
      [[0,0],[1,0],[1,1],[1,2]],
      [[0,1],[0,2],[1,1],[2,1]],
      [[1,0],[1,1],[1,2],[2,2]],
      [[0,1],[1,1],[2,0],[2,1]],
    ],
  },
  L: {
    colorVar: '--color-L',
    states: [
      [[0,2],[1,0],[1,1],[1,2]],
      [[0,1],[1,1],[2,1],[2,2]],
      [[1,0],[1,1],[1,2],[2,0]],
      [[0,0],[0,1],[1,1],[2,1]],
    ],
  },
};

// Spawn column for each type (centres piece on 10-wide board)
const SPAWN_COL = { I: 3, O: 4, T: 3, S: 3, Z: 3, J: 3, L: 3 };

// ============================================================
// SRS WALL-KICK TABLES
// Key: "fromState>toState"  (0=spawn, R=CW90, 2=180, L=CCW90)
// ============================================================
const SRS_KICKS = {
  '0>R': [ [0,0],[-1,0],[-1, 1],[0,-2],[-1,-2] ],
  'R>0': [ [0,0],[ 1,0],[ 1,-1],[0, 2],[ 1, 2] ],
  'R>2': [ [0,0],[ 1,0],[ 1,-1],[0, 2],[ 1, 2] ],
  '2>R': [ [0,0],[-1,0],[-1, 1],[0,-2],[-1,-2] ],
  '2>L': [ [0,0],[ 1,0],[ 1, 1],[0,-2],[ 1,-2] ],
  'L>2': [ [0,0],[-1,0],[-1,-1],[0, 2],[-1, 2] ],
  'L>0': [ [0,0],[-1,0],[-1,-1],[0, 2],[-1, 2] ],
  '0>L': [ [0,0],[ 1,0],[ 1, 1],[0,-2],[ 1,-2] ],
};

const SRS_KICKS_I = {
  '0>R': [ [0,0],[-2,0],[ 1,0],[-2,-1],[ 1, 2] ],
  'R>0': [ [0,0],[ 2,0],[-1,0],[ 2, 1],[-1,-2] ],
  'R>2': [ [0,0],[-1,0],[ 2,0],[-1, 2],[ 2,-1] ],
  '2>R': [ [0,0],[ 1,0],[-2,0],[ 1,-2],[-2, 1] ],
  '2>L': [ [0,0],[ 2,0],[-1,0],[ 2, 1],[-1,-2] ],
  'L>2': [ [0,0],[-2,0],[ 1,0],[-2,-1],[ 1, 2] ],
  'L>0': [ [0,0],[ 1,0],[-2,0],[ 1,-2],[-2, 1] ],
  '0>L': [ [0,0],[-1,0],[ 2,0],[-1, 2],[ 2,-1] ],
};

const ROT_STATE_NAME = ['0','R','2','L'];

// ============================================================
// 7-BAG RANDOMISER
// ============================================================
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

class Bag {
  constructor() { this._bag = []; }
  next() {
    if (this._bag.length === 0) this._bag = shuffle(['I','O','T','S','Z','J','L']);
    return this._bag.pop();
  }
}

// ============================================================
// STATE
// ============================================================
const state = {
  board:  [],
  piece:  null,
  bag:    null,
  nextQueue:  [],
  holdPiece:  null,
  holdUsed:   false,

  score:   0,
  hiScore: 0,
  level:   1,
  lines:   0,

  phase: 'start',  // 'start' | 'playing' | 'lineclear' | 'paused' | 'gameover'

  lastTime:    0,
  gravAccum:   0,
  lockActive:  false,
  lockTimer:   0,
  lockMoves:   0,

  softDropping: false,
  keysHeld:     {},   // action → { held: bool, dasTimer: 0, arrAccum: 0 }

  lastMoveWasRotation: false,
  lastKickIndex:       0,
  lastClearSpecial:    false,  // back-to-back tracking

  // line-clear animation
  lcRows:      [],
  lcTimer:     0,
  LC_DURATION: 180,   // ms

  // game-over animation
  goTimer:    0,
  GO_DURATION: 650,

  // combo
  combo: 0,
};

// ============================================================
// BOARD HELPERS
// ============================================================
function createBoard() {
  return Array.from({ length: BOARD_ROWS }, () => new Array(COLS).fill(null));
}

function getCells(piece) {
  const shape = TETROMINOES[piece.type].states[piece.rot];
  return shape.map(([dr, dc]) => [piece.row + dr, piece.col + dc]);
}

function isValid(cells, board) {
  for (const [r, c] of cells) {
    if (c < 0 || c >= COLS || r >= BOARD_ROWS) return false;
    if (r >= 0 && board[r][c] !== null) return false;
  }
  return true;
}

function getGhostRow(piece, board) {
  let row = piece.row;
  while (true) {
    const next = getCells({ ...piece, row: row + 1 });
    if (!isValid(next, board)) break;
    row++;
  }
  return row;
}

// ============================================================
// PIECE HELPERS
// ============================================================
function makePiece(type) {
  return { type, rot: 0, row: 0, col: SPAWN_COL[type] };
}

function spawnNext() {
  const type = state.nextQueue.shift();
  state.nextQueue.push(state.bag.next());
  state.piece = makePiece(type);
  state.lockActive = false;
  state.lockTimer  = 0;
  state.lockMoves  = 0;
  state.lastMoveWasRotation = false;
  state.holdUsed = false;

  if (!isValid(getCells(state.piece), state.board)) {
    triggerGameOver();
  }
}

// ============================================================
// MOVEMENT & ROTATION
// ============================================================
function tryMove(dr, dc) {
  if (state.phase !== 'playing') return false;
  const cells = getCells({ ...state.piece, row: state.piece.row + dr, col: state.piece.col + dc });
  if (!isValid(cells, state.board)) return false;
  state.piece.row += dr;
  state.piece.col += dc;
  state.lastMoveWasRotation = false;
  if (dc !== 0) resetLockDelay();
  return true;
}

function tryRotate(dir) {
  if (state.phase !== 'playing') return false;
  const { type, rot } = state.piece;
  const nextRot = dir === 'CW' ? (rot + 1) % 4 : (rot + 3) % 4;
  const key = ROT_STATE_NAME[rot] + '>' + ROT_STATE_NAME[nextRot];
  const kicks = type === 'I' ? SRS_KICKS_I[key] : SRS_KICKS[key];

  for (let i = 0; i < kicks.length; i++) {
    const [dr, dc] = kicks[i];
    const cells = getCells({
      ...state.piece, rot: nextRot,
      row: state.piece.row + dr, col: state.piece.col + dc,
    });
    if (isValid(cells, state.board)) {
      state.piece.rot = nextRot;
      state.piece.row += dr;
      state.piece.col += dc;
      state.lastMoveWasRotation = true;
      state.lastKickIndex = i;
      resetLockDelay();
      return true;
    }
  }
  return false;
}

function resetLockDelay() {
  if (!state.lockActive) return;
  if (state.lockMoves >= LOCK_MOVE_LIMIT) return;
  state.lockTimer = 0;
  state.lockMoves++;
}

// ============================================================
// HARD DROP / LOCK
// ============================================================
function hardDrop() {
  if (state.phase !== 'playing') return;
  const ghostRow = getGhostRow(state.piece, state.board);
  const dist = ghostRow - state.piece.row;
  state.score += dist * 2;
  state.piece.row = ghostRow;
  lockPiece();
}

function lockPiece() {
  const colorVar = TETROMINOES[state.piece.type].colorVar;
  for (const [r, c] of getCells(state.piece)) {
    if (r >= 0) state.board[r][c] = colorVar;
  }

  const tspinType = detectTSpin();

  const fullRows = [];
  for (let r = 0; r < BOARD_ROWS; r++) {
    if (state.board[r].every(c => c !== null)) fullRows.push(r);
  }

  if (fullRows.length > 0) {
    state.lcRows  = fullRows;
    state.lcTimer = 0;
    state.phase   = 'lineclear';
    state._pendingTSpin = tspinType;
  } else {
    addScore(0, tspinType);
    state.combo = 0;
    state.holdUsed = false;
    spawnNext();
  }
}

// ============================================================
// T-SPIN DETECTION  (3-corner rule)
// ============================================================
function detectTSpin() {
  if (state.piece.type !== 'T' || !state.lastMoveWasRotation) return 'none';
  const { row, col } = state.piece;
  // four corners of the 3×3 T bounding box
  const corners = [
    [row, col], [row, col+2], [row+2, col], [row+2, col+2],
  ];
  const occupied = corners.filter(([r, c]) =>
    r < 0 || r >= BOARD_ROWS || c < 0 || c >= COLS || (r >= 0 && state.board[r][c] !== null)
  ).length;

  if (occupied < 3) return 'none';
  if (state.lastKickIndex === 4) return 'mini';
  return 'full';
}

// ============================================================
// SCORING
// ============================================================
const BASE_SCORES = {
  single: 100, double: 300, triple: 500, tetris: 800,
  tspinNone: 400, tspinMini: 100,
  tspinSingle: 800, tspinDouble: 1200, tspinTriple: 1600,
};

function addScore(lines, tspinType) {
  const lv = state.level;
  const btb = state.lastClearSpecial;
  let base = 0;
  let isSpecial = false;
  let label = '';

  if (tspinType === 'full') {
    isSpecial = true;
    if      (lines === 0) { base = BASE_SCORES.tspinNone;   label = 'T-SPIN'; }
    else if (lines === 1) { base = BASE_SCORES.tspinSingle; label = 'T-SPIN SINGLE'; }
    else if (lines === 2) { base = BASE_SCORES.tspinDouble; label = 'T-SPIN DOUBLE'; }
    else                  { base = BASE_SCORES.tspinTriple; label = 'T-SPIN TRIPLE'; }
  } else if (tspinType === 'mini') {
    isSpecial = true;
    base  = BASE_SCORES.tspinMini;
    label = 'MINI T-SPIN';
  } else {
    if      (lines === 1) { base = BASE_SCORES.single; label = 'SINGLE'; }
    else if (lines === 2) { base = BASE_SCORES.double; label = 'DOUBLE'; }
    else if (lines === 3) { base = BASE_SCORES.triple; label = 'TRIPLE'; }
    else if (lines === 4) { base = BASE_SCORES.tetris; label = 'TETRIS'; isSpecial = true; }
  }

  const btbMult = (isSpecial && btb) ? 1.5 : 1;
  const comboBonus = state.combo > 0 ? 50 * state.combo * lv : 0;

  if (base > 0) {
    state.score += Math.floor(base * lv * btbMult) + comboBonus;
  }

  state.lastClearSpecial = isSpecial && lines > 0;

  if (lines > 0) {
    state.combo++;
    if (state.combo > 1) label += `  ×${state.combo} COMBO`;
    if (isSpecial && btb) label = 'BACK-TO-BACK ' + label;
    flashActionLabel(label);
  } else if (label) {
    flashActionLabel(label);
  }

  if (state.score > state.hiScore) {
    state.hiScore = state.score;
    try { localStorage.setItem('tetris-hiscore', String(state.hiScore)); } catch (_) {}
  }
}

// ============================================================
// LINE CLEAR (called after animation)
// ============================================================
function applyLineClear() {
  const rows = state.lcRows;
  for (const r of [...rows].sort((a, b) => b - a)) {
    state.board.splice(r, 1);
  }
  for (let i = 0; i < rows.length; i++) {
    state.board.unshift(new Array(COLS).fill(null));
  }
  addScore(rows.length, state._pendingTSpin || 'none');
  state.lines += rows.length;
  state.level  = Math.min(Math.floor(state.lines / LINES_PER_LEVEL) + 1, MAX_LEVEL);
  state._pendingTSpin = 'none';
  state.holdUsed = false;
  spawnNext();
  state.phase = 'playing';
}

// ============================================================
// HOLD
// ============================================================
function holdPiece() {
  if (state.phase !== 'playing' || state.holdUsed) return;
  const current = state.piece.type;
  if (state.holdPiece === null) {
    state.holdPiece = current;
    spawnNext();
  } else {
    const swapped = state.holdPiece;
    state.holdPiece = current;
    state.piece = makePiece(swapped);
    state.lockActive = false;
    state.lockTimer  = 0;
    state.lockMoves  = 0;
    state.lastMoveWasRotation = false;
  }
  state.holdUsed = true;
}

// ============================================================
// GRAVITY
// ============================================================
function applyGravity() {
  const moved = tryMove(1, 0);
  if (!moved) {
    if (!state.lockActive) {
      state.lockActive = true;
      state.lockTimer  = 0;
    }
    if (state.softDropping) state.score += 1;
  } else {
    if (state.softDropping) state.score += 1;
    state.lockActive = false;
    state.lockTimer  = 0;
  }
}

// ============================================================
// INPUT
// ============================================================
const KEY_ACTIONS = {
  ArrowLeft: 'left', a: 'left', A: 'left',
  ArrowRight: 'right', d: 'right', D: 'right',
  ArrowDown: 'softDrop', s: 'softDrop', S: 'softDrop',
  ArrowUp: 'rotateCW', w: 'rotateCW', W: 'rotateCW',
  x: 'rotateCW', X: 'rotateCW',
  z: 'rotateCCW', Z: 'rotateCCW', Control: 'rotateCCW',
  ' ': 'hardDrop',
  c: 'hold', C: 'hold',
  p: 'pause', P: 'pause', Escape: 'pause',
};

function initInput() {
  document.addEventListener('keydown', e => {
    const action = KEY_ACTIONS[e.key];
    if (!action) return;
    e.preventDefault();

    if (action === 'pause') { togglePause(); return; }
    if (state.phase !== 'playing') return;

    if (!state.keysHeld[action]) {
      state.keysHeld[action] = { dasTimer: 0, arrAccum: 0 };
      // Immediate action on first press
      switch (action) {
        case 'left':      tryMove(0, -1); break;
        case 'right':     tryMove(0,  1); break;
        case 'rotateCW':  tryRotate('CW');  break;
        case 'rotateCCW': tryRotate('CCW'); break;
        case 'hardDrop':  hardDrop(); break;
        case 'hold':      holdPiece(); break;
        case 'softDrop':  state.softDropping = true; break;
      }
    }
  });

  document.addEventListener('keyup', e => {
    const action = KEY_ACTIONS[e.key];
    if (!action) return;
    delete state.keysHeld[action];
    if (action === 'softDrop') state.softDropping = false;
  });
}

function processInput(dt) {
  for (const action of ['left', 'right']) {
    const key = state.keysHeld[action];
    if (!key) continue;
    key.dasTimer += dt;
    if (key.dasTimer < DAS_DELAY_MS) continue;
    key.arrAccum += dt;
    while (key.arrAccum >= ARR_MS) {
      key.arrAccum -= ARR_MS;
      if (action === 'left')  tryMove(0, -1);
      if (action === 'right') tryMove(0,  1);
    }
  }
}

// ============================================================
// SCREENS
// ============================================================
function showScreen(name) {
  document.querySelectorAll('.screen').forEach(el => el.classList.remove('visible'));
  if (name) document.getElementById('screen-' + name).classList.add('visible');
}

function togglePause() {
  if (state.phase === 'playing') {
    state.phase = 'paused';
    showScreen('pause');
  } else if (state.phase === 'paused') {
    state.phase   = 'playing';
    state.lastTime = performance.now();
    showScreen(null);
  }
}

function startGame() {
  state.board     = createBoard();
  state.bag       = new Bag();
  state.nextQueue = [state.bag.next(), state.bag.next(), state.bag.next()];
  state.holdPiece = null;
  state.holdUsed  = false;
  state.score     = 0;
  state.level     = 1;
  state.lines     = 0;
  state.combo     = 0;
  state.lastClearSpecial = false;
  state.keysHeld  = {};
  state.softDropping = false;
  state.phase     = 'playing';
  state.goTimer   = 0;
  state.lcRows    = [];
  try { state.hiScore = parseInt(localStorage.getItem('tetris-hiscore') || '0', 10) || 0; } catch (_) {}
  spawnNext();
  showScreen(null);
  state.lastTime = performance.now();
}

function triggerGameOver() {
  state.phase   = 'gameover';
  state.goTimer = 0;
  setTimeout(() => {
    document.getElementById('gameover-score').textContent = state.score.toLocaleString();
    showScreen('gameover');
  }, state.GO_DURATION + 100);
}

// ============================================================
// ACTION LABEL FLASH
// ============================================================
let _labelTimeout = null;
function flashActionLabel(text) {
  if (!text) return;
  const el = document.getElementById('action-label');
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(_labelTimeout);
  _labelTimeout = setTimeout(() => el.classList.remove('show'), 1400);
}

// ============================================================
// RENDERING
// ============================================================
const canvas    = document.getElementById('game-canvas');
const ctx       = canvas.getContext('2d');
const holdCanvas = document.getElementById('hold-canvas');
const holdCtx    = holdCanvas.getContext('2d');
const nextCanvases = [0,1,2].map(i => document.getElementById('next-canvas-' + i));
const nextCtxs     = nextCanvases.map(c => c.getContext('2d'));

// Resolved color cache (populated in setup)
const COLORS = {};

function resolveColors() {
  const style = getComputedStyle(document.documentElement);
  for (const type of ['I','O','T','S','Z','J','L']) {
    const varName = TETROMINOES[type].colorVar;
    COLORS[type] = style.getPropertyValue(varName).trim();
  }
}

function setupCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const logW = COLS * CELL;
  const logH = VISIBLE_ROWS * CELL;
  canvas.width  = logW * dpr;
  canvas.height = logH * dpr;
  canvas.style.width  = logW + 'px';
  canvas.style.height = logH + 'px';
  ctx.scale(dpr, dpr);
}

// Draw a single filled cell at logical (col, row) on given context
function drawCell(c, x, y, color, alpha, glow) {
  c.save();
  c.globalAlpha = alpha ?? 1;
  if (glow) {
    c.shadowBlur  = 14;
    c.shadowColor = color;
  }
  // Main fill with subtle gradient
  const grad = c.createLinearGradient(x, y, x + CELL, y + CELL);
  grad.addColorStop(0, color);
  grad.addColorStop(1, colorAlpha(color, 0.6));
  c.fillStyle = grad;
  c.fillRect(x + 1, y + 1, CELL - 2, CELL - 2);

  // Inner highlight (top/left shine)
  c.shadowBlur = 0;
  c.fillStyle  = 'rgba(255,255,255,0.18)';
  c.fillRect(x + 2, y + 2, CELL - 4, 4);
  c.fillRect(x + 2, y + 6, 4, CELL - 8);
  c.restore();
}

function colorAlpha(hex, a) {
  // hex is like #00f5ff; returns rgba
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${a})`;
}

function drawGrid() {
  ctx.strokeStyle = 'rgba(255,255,255,0.04)';
  ctx.lineWidth   = 0.5;
  for (let c = 0; c <= COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * CELL, 0);
    ctx.lineTo(c * CELL, VISIBLE_ROWS * CELL);
    ctx.stroke();
  }
  for (let r = 0; r <= VISIBLE_ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * CELL);
    ctx.lineTo(COLS * CELL, r * CELL);
    ctx.stroke();
  }
}

function drawBoard() {
  for (let r = BUFFER_ROWS; r < BOARD_ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const colorVar = state.board[r][c];
      if (!colorVar) continue;
      const type = colorVar.replace('--color-','');
      const color = COLORS[type];
      const visR = r - BUFFER_ROWS;
      drawCell(ctx, c * CELL, visR * CELL, color, 1, false);
    }
  }
}

function drawPiece(piece, alpha, glow) {
  if (!piece) return;
  const color = COLORS[piece.type];
  for (const [dr, dc] of TETROMINOES[piece.type].states[piece.rot]) {
    const visR = (piece.row + dr) - BUFFER_ROWS;
    if (visR < 0) continue;
    drawCell(ctx, (piece.col + dc) * CELL, visR * CELL, color, alpha, glow);
  }
}

function drawGhost() {
  if (!state.piece) return;
  const ghostRow = getGhostRow(state.piece, state.board);
  if (ghostRow === state.piece.row) return;
  const color = COLORS[state.piece.type];
  for (const [dr, dc] of TETROMINOES[state.piece.type].states[state.piece.rot]) {
    const visR = (ghostRow + dr) - BUFFER_ROWS;
    if (visR < 0) continue;
    const x = (state.piece.col + dc) * CELL;
    const y = visR * CELL;
    ctx.save();
    ctx.globalAlpha = 0.28;
    ctx.strokeStyle = color;
    ctx.lineWidth   = 1.5;
    ctx.strokeRect(x + 1.5, y + 1.5, CELL - 3, CELL - 3);
    ctx.restore();
  }
}

function drawLineClearAnim(progress) {
  // progress: 0→1; flash then fade
  for (const r of state.lcRows) {
    const visR = r - BUFFER_ROWS;
    if (visR < 0) continue;
    const alpha = progress < 0.4 ? 1 : 1 - (progress - 0.4) / 0.6;
    ctx.save();
    ctx.globalAlpha = alpha * 0.9;
    ctx.fillStyle   = '#ffffff';
    ctx.shadowBlur  = 28;
    ctx.shadowColor = '#ffffff';
    ctx.fillRect(0, visR * CELL + 1, COLS * CELL, CELL - 2);
    ctx.restore();
  }
}

function drawGameOverAnim(progress) {
  // Fill board rows from bottom to top progressively
  const rowsFilled = Math.ceil(progress * VISIBLE_ROWS);
  for (let i = 0; i < rowsFilled; i++) {
    const visR = VISIBLE_ROWS - 1 - i;
    ctx.save();
    const a = Math.min(1, progress * 2.5);
    ctx.globalAlpha = a * 0.82;
    ctx.fillStyle   = '#0a0a0f';
    ctx.fillRect(0, visR * CELL, COLS * CELL, CELL);
    ctx.restore();
  }
}

// Mini canvas renderer for hold and next preview
function drawMiniPiece(c, type, canvasW, canvasH, size) {
  const dpr = window.devicePixelRatio || 1;
  c.clearRect(0, 0, canvasW * dpr, canvasH * dpr);
  if (!type) return;
  const color  = COLORS[type];
  const cells  = TETROMINOES[type].states[0];

  // Compute bounding box
  let minR = Infinity, maxR = -Infinity, minC = Infinity, maxC = -Infinity;
  for (const [dr, dc] of cells) {
    minR = Math.min(minR, dr); maxR = Math.max(maxR, dr);
    minC = Math.min(minC, dc); maxC = Math.max(maxC, dc);
  }
  const pieceW = (maxC - minC + 1) * size;
  const pieceH = (maxR - minR + 1) * size;
  const offX = (canvasW - pieceW) / 2;
  const offY = (canvasH - pieceH) / 2;

  for (const [dr, dc] of cells) {
    const x = offX + (dc - minC) * size;
    const y = offY + (dr - minR) * size;
    c.save();
    const grad = c.createLinearGradient(x, y, x + size, y + size);
    grad.addColorStop(0, color);
    grad.addColorStop(1, colorAlpha(color, 0.6));
    c.fillStyle = grad;
    c.shadowBlur  = 8;
    c.shadowColor = color;
    c.fillRect(x + 1, y + 1, size - 2, size - 2);
    c.fillStyle = 'rgba(255,255,255,0.18)';
    c.shadowBlur = 0;
    c.fillRect(x + 2, y + 2, size - 4, 3);
    c.fillRect(x + 2, y + 5, 3, size - 7);
    c.restore();
  }
}

function setupMiniCanvases() {
  const dpr = window.devicePixelRatio || 1;
  [[holdCanvas, 120, 120], ...nextCanvases.map((cv, i) => [cv, 120, i === 0 ? 120 : 80])].forEach(([cv, w, h]) => {
    cv.width  = w * dpr;
    cv.height = h * dpr;
    cv.style.width  = w + 'px';
    cv.style.height = h + 'px';
    cv.getContext('2d').scale(dpr, dpr);
  });
}

function updateHUD() {
  document.getElementById('score-value').textContent   = state.score.toLocaleString();
  document.getElementById('hiscore-value').textContent = state.hiScore.toLocaleString();
  document.getElementById('level-value').textContent   = state.level;
  document.getElementById('lines-value').textContent   = state.lines;
}

function render(dt) {
  // Clear
  ctx.clearRect(0, 0, COLS * CELL, VISIBLE_ROWS * CELL);

  drawGrid();
  drawBoard();

  if (state.phase === 'playing' || state.phase === 'paused') {
    drawGhost();
    drawPiece(state.piece, 1, true);
  }

  if (state.phase === 'lineclear') {
    drawGhost();
    drawPiece(state.piece, 0.35, false);
    const progress = Math.min(state.lcTimer / state.LC_DURATION, 1);
    drawLineClearAnim(progress);
  }

  if (state.phase === 'gameover') {
    const progress = Math.min(state.goTimer / state.GO_DURATION, 1);
    drawGameOverAnim(progress);
  }

  // Mini canvases
  drawMiniPiece(holdCtx, state.holdPiece, 120, 120, 24);
  drawMiniPiece(nextCtxs[0], state.nextQueue[0], 120, 120, 24);
  drawMiniPiece(nextCtxs[1], state.nextQueue[1], 120, 80, 20);
  drawMiniPiece(nextCtxs[2], state.nextQueue[2], 120, 80, 20);

  updateHUD();
}

// ============================================================
// GAME LOOP
// ============================================================
function gameLoop(timestamp) {
  const dt = Math.min(timestamp - state.lastTime, 100);
  state.lastTime = timestamp;

  if (state.phase === 'playing') {
    processInput(dt);

    const gravMs = state.softDropping
      ? GRAVITY_TABLE[state.level - 1] / SOFT_DROP_MULT
      : GRAVITY_TABLE[state.level - 1];

    state.gravAccum += dt;
    while (state.gravAccum >= gravMs) {
      state.gravAccum -= gravMs;
      applyGravity();
    }

    if (state.lockActive) {
      state.lockTimer += dt;
      if (state.lockTimer >= LOCK_DELAY_MS || state.lockMoves >= LOCK_MOVE_LIMIT) {
        lockPiece();
      }
    }
  }

  if (state.phase === 'lineclear') {
    state.lcTimer += dt;
    if (state.lcTimer >= state.LC_DURATION) {
      applyLineClear();
    }
  }

  if (state.phase === 'gameover') {
    state.goTimer += dt;
  }

  render(dt);
  requestAnimationFrame(gameLoop);
}

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  setupCanvas();
  setupMiniCanvases();
  resolveColors();

  try { state.hiScore = parseInt(localStorage.getItem('tetris-hiscore') || '0', 10) || 0; } catch (_) {}

  document.getElementById('btn-start').addEventListener('click', startGame);
  document.getElementById('btn-resume').addEventListener('click', togglePause);
  document.getElementById('btn-restart').addEventListener('click', startGame);

  initInput();
  showScreen('start');

  state.lastTime = performance.now();
  requestAnimationFrame(gameLoop);
});
