const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");
const scoreEl = document.getElementById("score");
const linesEl = document.getElementById("lines");
const levelEl = document.getElementById("level");
const restartBtn = document.getElementById("restart");

const COLS = 10;
const ROWS = 20;
const BLOCK = canvas.width / COLS;

const COLORS = {
  I: "#38bdf8",
  J: "#6366f1",
  L: "#f97316",
  O: "#facc15",
  S: "#4ade80",
  T: "#a855f7",
  Z: "#f43f5e",
};

const SHAPES = {
  I: [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  J: [
    [1, 0, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  L: [
    [0, 0, 1],
    [1, 1, 1],
    [0, 0, 0],
  ],
  O: [
    [1, 1],
    [1, 1],
  ],
  S: [
    [0, 1, 1],
    [1, 1, 0],
    [0, 0, 0],
  ],
  T: [
    [0, 1, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  Z: [
    [1, 1, 0],
    [0, 1, 1],
    [0, 0, 0],
  ],
};

const CLEAR_SCORES = [0, 100, 300, 500, 800];

let board;
let piece;
let dropCounter = 0;
let dropInterval = 1000;
let lastTime = 0;
let linesCleared = 0;
let level = 1;
let score = 0;
let bag = [];
let running = true;
let animationId = null;

function createBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function drawCell(x, y, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x * BLOCK, y * BLOCK, BLOCK, BLOCK);
  ctx.strokeStyle = "rgba(15,23,42,0.6)";
  ctx.lineWidth = 2;
  ctx.strokeRect(x * BLOCK, y * BLOCK, BLOCK, BLOCK);
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 0; x < COLS; x += 1) {
      const cell = board[y][x];
      if (cell) {
        drawCell(x, y, COLORS[cell]);
      }
    }
  }

  if (piece) {
    piece.shape.forEach((row, dy) => {
      row.forEach((value, dx) => {
        if (value) {
          drawCell(piece.x + dx, piece.y + dy, COLORS[piece.type]);
        }
      });
    });
  }
}

function rotate(matrix) {
  const size = matrix.length;
  const result = matrix.map((row) => [...row]);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      result[x][size - 1 - y] = matrix[y][x];
    }
  }
  return result;
}

function collides(shape, offsetX, offsetY) {
  for (let y = 0; y < shape.length; y += 1) {
    for (let x = 0; x < shape[y].length; x += 1) {
      if (!shape[y][x]) continue;
      const newX = offsetX + x;
      const newY = offsetY + y;
      if (newX < 0 || newX >= COLS || newY >= ROWS) {
        return true;
      }
      if (newY < 0) continue;
      if (board[newY][newX]) {
        return true;
      }
    }
  }
  return false;
}

function mergePiece() {
  piece.shape.forEach((row, dy) => {
    row.forEach((value, dx) => {
      if (value && piece.y + dy >= 0) {
        board[piece.y + dy][piece.x + dx] = piece.type;
      }
    });
  });
}

function sweep() {
  let cleared = 0;
  outer: for (let y = ROWS - 1; y >= 0; y -= 1) {
    for (let x = 0; x < COLS; x += 1) {
      if (!board[y][x]) {
        continue outer;
      }
    }
    const row = board.splice(y, 1)[0].fill(null);
    board.unshift(row);
    cleared += 1;
    y += 1;
  }

  if (cleared > 0) {
    score += CLEAR_SCORES[cleared] * level;
    linesCleared += cleared;
    level = 1 + Math.floor(linesCleared / 10);
    dropInterval = Math.max(150, 1000 - (level - 1) * 100);
    updateUI();
  }
}

function randomPiece() {
  if (bag.length === 0) {
    bag = Object.keys(SHAPES)
      .map((type) => ({ type, sort: Math.random() }))
      .sort((a, b) => a.sort - b.sort)
      .map(({ type }) => type);
  }
  const type = bag.pop();
  const shape = SHAPES[type].map((row) => [...row]);
  return {
    type,
    shape,
    x: Math.floor(COLS / 2) - Math.ceil(shape[0].length / 2),
    y: -shape.length,
  };
}

function drop() {
  if (!piece) return;
  if (!collides(piece.shape, piece.x, piece.y + 1)) {
    piece.y += 1;
  } else {
    mergePiece();
    sweep();
    spawnPiece();
  }
}

function spawnPiece() {
  piece = randomPiece();
  if (collides(piece.shape, piece.x, piece.y)) {
    running = false;
    updateUI();
  }
}

function update(time = 0) {
  if (!running) {
    draw();
    animationId = null;
    return;
  }
  const delta = time - lastTime;
  lastTime = time;
  dropCounter += delta;
  if (dropCounter > dropInterval) {
    drop();
    dropCounter = 0;
  }
  draw();
  animationId = requestAnimationFrame(update);
}

function move(dir) {
  const newX = piece.x + dir;
  if (!collides(piece.shape, newX, piece.y)) {
    piece.x = newX;
  }
}

function hardDrop() {
  while (!collides(piece.shape, piece.x, piece.y + 1)) {
    piece.y += 1;
  }
  drop();
}

function tryRotate(newShape) {
  const kickOffsets = [0, -1, 1, -2, 2];
  for (const offset of kickOffsets) {
    if (!collides(newShape, piece.x + offset, piece.y)) {
      piece.shape = newShape;
      piece.x += offset;
      return true;
    }
  }
  return false;
}

function rotatePieceClockwise() {
  const rotated = rotate(piece.shape);
  tryRotate(rotated);
}

function rotatePieceCounterclockwise() {
  const rotated = rotate(rotate(rotate(piece.shape)));
  tryRotate(rotated);
}

function handleKeydown(event) {
  if (!running) return;
  switch (event.key) {
    case "ArrowLeft":
      move(-1);
      break;
    case "ArrowRight":
      move(1);
      break;
    case "ArrowDown":
      drop();
      dropCounter = 0;
      break;
    case "ArrowUp":
    case "x":
    case "X":
      rotatePieceClockwise();
      break;
    case " ":
      hardDrop();
      break;
    case "z":
    case "Z":
      rotatePieceCounterclockwise();
      break;
    default:
      return;
  }
  draw();
  event.preventDefault();
}

function updateUI() {
  scoreEl.textContent = score.toString();
  linesEl.textContent = linesCleared.toString();
  levelEl.textContent = level.toString();
  if (!running) {
    restartBtn.textContent = "Play again";
    restartBtn.focus();
  } else {
    restartBtn.textContent = "Restart";
  }
}

function reset() {
  if (animationId !== null) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }
  board = createBoard();
  piece = null;
  score = 0;
  linesCleared = 0;
  level = 1;
  dropInterval = 1000;
  dropCounter = 0;
  lastTime = 0;
  running = true;
  bag = [];
  spawnPiece();
  updateUI();
  update();
}

restartBtn.addEventListener("click", () => {
  reset();
});

document.addEventListener("keydown", handleKeydown);

reset();
