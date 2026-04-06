const GRID_SIZE = 9;
const SQUARE_SIZE = 3;
const BG_COLOR = "#444444";
const CELL_BORDER_COLOR = "black";
const SQUARE_BORDER_COLOR = "white";
const TEXT_COLOR = "white";
const HINT_COLOR = "#bbbbbb";
const HINT_SINGLE_COLOR = "lime";
const DEFAULT_DIFFICULTIES = ["лёгкий", "средний", "сложный", "мамкино дупло"];
const FEATURE_GONE_MESSAGE = "Страница Sudoku недоступна.";
const AUTO_SOLVE_INSULT_MESSAGE = "лох, гей, нет друзей. Не смог судоку решить...";
const MANUAL_WIN_MESSAGE = "🎉 Поздравляем! Головоломка решена!";
const CELEBRATION_DURATION_MS = 2500;

const COMPLETION_STATE = Object.freeze({
  IN_PROGRESS: "in_progress",
  MANUAL_WIN: "manual_win",
  AUTO_SOLVE: "auto_solve"
});

const API = Object.freeze({
  bootstrap: "/sudoku/api/bootstrap",
  generate: "/sudoku/api/generate",
  validate: "/sudoku/api/validate",
  solve: "/sudoku/api/solve"
});

const state = {
  cellValues: makeBlankBoard(),
  cellHints: makeHintGrid(),
  selected: [0, 0],
  solvedCache: null,
  solvedCacheField: null,
  completionState: COMPLETION_STATE.IN_PROGRESS,
  errorCells: new Set(),
  solutionMap: null,
  solutionMapReady: false,
  solutionMapField: null,
  difficultyVar: "средний",
  toggleHighlightLines: false,
  toggleShowHints: false,
  toggleHighlightAnswers: false,
  consoleVisible: true,
  progress: null,
  canvasRect: { width: 0, height: 0 },
  celebrationHideTimerId: 0,
  initialized: false
};

const refs = {};
let boardResizeObserver = null;

document.addEventListener("DOMContentLoaded", () => {
  void init();
});

async function init() {
  captureRefs();
  bindEvents();
  applyDifficultyOptions(DEFAULT_DIFFICULTIES);
  syncToggleInputs();
  resizeCanvas();
  const bootstrapped = await bootstrap();
  updateHints();
  checkAndUpdateErrors();
  drawCells();
  log("Программа запущена.");
  state.initialized = true;
  if (!bootstrapped) {
    setControlsDisabled(true);
  }
}

function captureRefs() {
  refs.status = document.getElementById("sudoku-status");
  refs.canvas = document.getElementById("sudoku-canvas");
  refs.boardStage = document.getElementById("sudoku-board-stage");
  refs.highlightLines = document.getElementById("toggle-highlight-lines");
  refs.showHints = document.getElementById("toggle-show-hints");
  refs.highlightAnswers = document.getElementById("toggle-highlight-answers");
  refs.difficultySelect = document.getElementById("sudoku-difficulty-select");
  refs.generateButton = document.getElementById("sudoku-generate-btn");
  refs.clearButton = document.getElementById("sudoku-clear-btn");
  refs.hintButton = document.getElementById("sudoku-hint-btn");
  refs.solveButton = document.getElementById("sudoku-solve-btn");
  refs.validateButton = document.getElementById("sudoku-validate-btn");
  refs.infoButton = document.getElementById("sudoku-info-btn");
  refs.logCard = document.getElementById("sudoku-log-card");
  refs.log = document.getElementById("sudoku-log");
  refs.toggleLogButton = document.getElementById("sudoku-toggle-log-btn");
  refs.clearLogButton = document.getElementById("sudoku-clear-log-btn");
  refs.copyLogButton = document.getElementById("sudoku-copy-log-btn");
  refs.saveLogButton = document.getElementById("sudoku-save-log-btn");
  refs.infoDialog = document.getElementById("sudoku-info-dialog");
  refs.infoCloseButton = document.getElementById("sudoku-info-close-btn");
  refs.celebration = document.getElementById("sudoku-celebration");
}

function bindEvents() {
  refs.canvas.addEventListener("click", onCanvasClick);
  refs.difficultySelect.addEventListener("change", () => {
    state.difficultyVar = refs.difficultySelect.value || "средний";
  });
  refs.highlightLines.addEventListener("change", () => {
    state.toggleHighlightLines = refs.highlightLines.checked;
    drawCells();
  });
  refs.showHints.addEventListener("change", () => {
    state.toggleShowHints = refs.showHints.checked;
    drawCells();
  });
  refs.highlightAnswers.addEventListener("change", () => {
    state.toggleHighlightAnswers = refs.highlightAnswers.checked;
    updateHints();
    checkAndUpdateErrors();
    drawCells();
  });
  refs.generateButton.addEventListener("click", () => {
    void generatePuzzle();
  });
  refs.clearButton.addEventListener("click", clearAll);
  refs.hintButton.addEventListener("click", hintCell);
  refs.solveButton.addEventListener("click", () => {
    void solvePuzzle();
  });
  refs.validateButton.addEventListener("click", () => {
    void validateUserInput();
  });
  refs.infoButton.addEventListener("click", openInfoDialog);
  refs.toggleLogButton.addEventListener("click", toggleConsole);
  refs.clearLogButton.addEventListener("click", clearLog);
  refs.copyLogButton.addEventListener("click", () => {
    void copyLog();
  });
  refs.saveLogButton.addEventListener("click", saveLog);
  refs.infoCloseButton.addEventListener("click", closeInfoDialog);
  refs.infoDialog.addEventListener("click", (event) => {
    if (event.target === refs.infoDialog) {
      closeInfoDialog();
    }
  });
  window.addEventListener("resize", resizeCanvas);
  document.addEventListener("keydown", onKeyDown);

  if (typeof ResizeObserver !== "undefined") {
    boardResizeObserver = new ResizeObserver(() => {
      resizeCanvas();
    });
    boardResizeObserver.observe(refs.boardStage);
  }
}

async function bootstrap() {
  const result = await apiRequest(API.bootstrap);
  if (!result.ok) {
    handleApiFailure(result, FEATURE_GONE_MESSAGE);
    return false;
  }

  hideStatus();
  const data = result.data || {};
  const toggles = data.toggles || {};
  state.difficultyVar = typeof data.initialDifficulty === "string" ? data.initialDifficulty : "средний";
  state.toggleHighlightLines = Boolean(toggles.highlightLines);
  state.toggleShowHints = Boolean(toggles.showHints);
  state.toggleHighlightAnswers = Boolean(toggles.highlightAnswers);
  state.consoleVisible = data.consoleVisible !== false;

  applyDifficultyOptions(Array.isArray(data.difficultyOptions) ? data.difficultyOptions : DEFAULT_DIFFICULTIES);
  refs.difficultySelect.value = state.difficultyVar;
  syncToggleInputs();
  applyConsoleVisibility();
  return true;
}

function applyDifficultyOptions(options) {
  const values = Array.isArray(options) && options.length ? options : DEFAULT_DIFFICULTIES;
  refs.difficultySelect.innerHTML = "";
  values.forEach((item) => {
    const option = document.createElement("option");
    option.value = item;
    option.textContent = item;
    refs.difficultySelect.append(option);
  });
}

function syncToggleInputs() {
  refs.highlightLines.checked = state.toggleHighlightLines;
  refs.showHints.checked = state.toggleShowHints;
  refs.highlightAnswers.checked = state.toggleHighlightAnswers;
}

function setControlsDisabled(disabled) {
  document.querySelectorAll(".sudoku-page button, .sudoku-page select, .sudoku-page input").forEach((node) => {
    node.disabled = disabled;
  });
}

function showStatus(message) {
  refs.status.hidden = false;
  refs.status.textContent = message;
}

function hideStatus() {
  refs.status.hidden = true;
  refs.status.textContent = "";
}

function setCompletionState(nextState) {
  state.completionState = Object.values(COMPLETION_STATE).includes(nextState)
    ? nextState
    : COMPLETION_STATE.IN_PROGRESS;
}

function isEraseKey(key) {
  return key === "Backspace" || key === "Delete" || key === "0" || key === " ";
}

function clearCelebrationTimer() {
  if (!state.celebrationHideTimerId) {
    return;
  }
  window.clearTimeout(state.celebrationHideTimerId);
  state.celebrationHideTimerId = 0;
}

function hideCelebration() {
  clearCelebrationTimer();
  if (!refs.celebration) {
    return;
  }
  refs.celebration.hidden = true;
  refs.celebration.classList.remove("is-visible");
}

function showCelebration() {
  if (!refs.celebration) {
    return;
  }

  hideCelebration();
  refs.celebration.hidden = false;
  void refs.celebration.offsetWidth;
  refs.celebration.classList.add("is-visible");
  state.celebrationHideTimerId = window.setTimeout(() => {
    hideCelebration();
  }, CELEBRATION_DURATION_MS);
}

function completeManualWin() {
  setCompletionState(COMPLETION_STATE.MANUAL_WIN);
  log(MANUAL_WIN_MESSAGE);
  showCelebration();
}

function makeBlankBoard() {
  return Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(0));
}

function makeHintGrid() {
  return Array.from({ length: GRID_SIZE }, () =>
    Array.from({ length: GRID_SIZE }, () => new Set([1, 2, 3, 4, 5, 6, 7, 8, 9]))
  );
}

function normalizeBoard(value) {
  if (!Array.isArray(value) || value.length !== GRID_SIZE) {
    return makeBlankBoard();
  }

  return value.map((row) => {
    if (!Array.isArray(row) || row.length !== GRID_SIZE) {
      return Array(GRID_SIZE).fill(0);
    }
    return row.map((cell) => {
      const number = Number.parseInt(cell, 10);
      if (!Number.isInteger(number) || number < 0 || number > GRID_SIZE) {
        return 0;
      }
      return number;
    });
  });
}

function copyBoard(board) {
  return normalizeBoard(board).map((row) => row.slice());
}

function boardCellKey(row, col) {
  return `${row}:${col}`;
}

function hasErrorCell(row, col) {
  return state.errorCells.has(boardCellKey(row, col));
}

function updateHints() {
  state.cellHints = makeHintGrid();

  for (let row = 0; row < GRID_SIZE; row += 1) {
    for (let col = 0; col < GRID_SIZE; col += 1) {
      if (state.cellValues[row][col]) {
        state.cellHints[row][col] = new Set();
        continue;
      }

      const used = new Set(state.cellValues[row]);
      for (let index = 0; index < GRID_SIZE; index += 1) {
        used.add(state.cellValues[index][col]);
      }

      const blockRow = Math.floor(row / SQUARE_SIZE) * SQUARE_SIZE;
      const blockCol = Math.floor(col / SQUARE_SIZE) * SQUARE_SIZE;
      for (let deltaRow = 0; deltaRow < SQUARE_SIZE; deltaRow += 1) {
        for (let deltaCol = 0; deltaCol < SQUARE_SIZE; deltaCol += 1) {
          used.add(state.cellValues[blockRow + deltaRow][blockCol + deltaCol]);
        }
      }

      const hints = new Set();
      for (let number = 1; number <= 9; number += 1) {
        if (!used.has(number)) {
          hints.add(number);
        }
      }
      state.cellHints[row][col] = hints;
    }
  }

  if (!state.toggleHighlightAnswers) {
    return;
  }

  let changed = true;
  while (changed) {
    changed = false;
    for (let row = 0; row < GRID_SIZE; row += 1) {
      for (let col = 0; col < GRID_SIZE; col += 1) {
        if (state.cellValues[row][col] || state.cellHints[row][col].size !== 1) {
          continue;
        }

        const [greenNumber] = Array.from(state.cellHints[row][col]);
        for (let nextRow = 0; nextRow < GRID_SIZE; nextRow += 1) {
          for (let nextCol = 0; nextCol < GRID_SIZE; nextCol += 1) {
            if ((nextRow === row && nextCol === col) || state.cellValues[nextRow][nextCol]) {
              continue;
            }
            const sameSquare =
              Math.floor(nextRow / SQUARE_SIZE) === Math.floor(row / SQUARE_SIZE) &&
              Math.floor(nextCol / SQUARE_SIZE) === Math.floor(col / SQUARE_SIZE);
            if (nextRow === row || nextCol === col || sameSquare) {
              if (state.cellHints[nextRow][nextCol].has(greenNumber)) {
                state.cellHints[nextRow][nextCol].delete(greenNumber);
                changed = true;
              }
            }
          }
        }
      }
    }
  }
}

function isSingleInSquare(row, col, value) {
  if (!state.cellHints[row][col].has(value)) {
    return false;
  }

  const blockRow = Math.floor(row / SQUARE_SIZE) * SQUARE_SIZE;
  const blockCol = Math.floor(col / SQUARE_SIZE) * SQUARE_SIZE;
  let count = 0;

  for (let deltaRow = 0; deltaRow < SQUARE_SIZE; deltaRow += 1) {
    for (let deltaCol = 0; deltaCol < SQUARE_SIZE; deltaCol += 1) {
      const nextRow = blockRow + deltaRow;
      const nextCol = blockCol + deltaCol;
      if (state.cellHints[nextRow][nextCol].has(value)) {
        count += 1;
      }
    }
  }
  return count === 1;
}

function checkAndUpdateErrors() {
  const errors = new Set();

  for (let index = 0; index < GRID_SIZE; index += 1) {
    const rowValues = new Map();
    const colValues = new Map();
    for (let offset = 0; offset < GRID_SIZE; offset += 1) {
      const rowValue = state.cellValues[index][offset];
      if (rowValue) {
        if (rowValues.has(rowValue)) {
          errors.add(boardCellKey(index, offset));
          errors.add(boardCellKey(index, rowValues.get(rowValue)));
        } else {
          rowValues.set(rowValue, offset);
        }
      }

      const colValue = state.cellValues[offset][index];
      if (colValue) {
        if (colValues.has(colValue)) {
          errors.add(boardCellKey(offset, index));
          errors.add(boardCellKey(colValues.get(colValue), index));
        } else {
          colValues.set(colValue, offset);
        }
      }
    }
  }

  for (let blockRow = 0; blockRow < GRID_SIZE; blockRow += SQUARE_SIZE) {
    for (let blockCol = 0; blockCol < GRID_SIZE; blockCol += SQUARE_SIZE) {
      const squareValues = new Map();
      for (let deltaRow = 0; deltaRow < SQUARE_SIZE; deltaRow += 1) {
        for (let deltaCol = 0; deltaCol < SQUARE_SIZE; deltaCol += 1) {
          const row = blockRow + deltaRow;
          const col = blockCol + deltaCol;
          const value = state.cellValues[row][col];
          if (!value) {
            continue;
          }
          if (squareValues.has(value)) {
            const [prevRow, prevCol] = squareValues.get(value);
            errors.add(boardCellKey(row, col));
            errors.add(boardCellKey(prevRow, prevCol));
          } else {
            squareValues.set(value, [row, col]);
          }
        }
      }
    }
  }

  if (state.solutionMapReady && state.solutionMap) {
    for (let row = 0; row < GRID_SIZE; row += 1) {
      for (let col = 0; col < GRID_SIZE; col += 1) {
        const value = state.cellValues[row][col];
        if (value && state.solutionMap[row][col] !== value) {
          errors.add(boardCellKey(row, col));
        }
      }
    }
  }

  state.errorCells = errors;
}

function resizeCanvas() {
  const rect = refs.canvas.getBoundingClientRect();
  const width = Math.max(1, Math.floor(rect.width));
  const height = Math.max(1, Math.floor(rect.height));
  const dpr = window.devicePixelRatio || 1;
  refs.canvas.width = Math.floor(width * dpr);
  refs.canvas.height = Math.floor(height * dpr);
  const ctx = refs.canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  state.canvasRect = { width, height };
  drawCells();
}

function getBoardMetrics() {
  const width = state.canvasRect.width || refs.canvas.clientWidth;
  const height = state.canvasRect.height || refs.canvas.clientHeight;
  const innerPadding = Math.max(18, Math.floor(Math.min(width, height) * 0.045));
  const usableSize = Math.max(0, Math.min(width, height) - innerPadding * 2);
  const cellSize = Math.floor(usableSize / GRID_SIZE);
  if (!cellSize) {
    return null;
  }
  const boardSize = cellSize * GRID_SIZE;
  return {
    width,
    height,
    cellSize,
    boardSize,
    offsetX: Math.floor((width - boardSize) / 2),
    offsetY: Math.floor((height - boardSize) / 2)
  };
}

function drawGrid(ctx, metrics) {
  for (let index = 0; index <= GRID_SIZE; index += 1) {
    const width = index % SQUARE_SIZE === 0 ? 4 : 2;
    const color = index % SQUARE_SIZE === 0 ? SQUARE_BORDER_COLOR : CELL_BORDER_COLOR;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;

    const x = metrics.offsetX + index * metrics.cellSize;
    ctx.beginPath();
    ctx.moveTo(x, metrics.offsetY);
    ctx.lineTo(x, metrics.offsetY + metrics.boardSize);
    ctx.stroke();

    const y = metrics.offsetY + index * metrics.cellSize;
    ctx.beginPath();
    ctx.moveTo(metrics.offsetX, y);
    ctx.lineTo(metrics.offsetX + metrics.boardSize, y);
    ctx.stroke();
  }
}

function drawCells() {
  const metrics = getBoardMetrics();
  if (!metrics) {
    return;
  }

  const ctx = refs.canvas.getContext("2d");
  ctx.clearRect(0, 0, metrics.width, metrics.height);

  ctx.fillStyle = "#3d3d3d";
  ctx.fillRect(0, 0, metrics.width, metrics.height);

  ctx.fillStyle = BG_COLOR;
  ctx.fillRect(metrics.offsetX, metrics.offsetY, metrics.boardSize, metrics.boardSize);

  const [selectedRow, selectedCol] = state.selected;
  const selectedValue = state.cellValues[selectedRow][selectedCol];

  if (selectedValue && state.toggleHighlightLines) {
    const sameValueCells = [];
    for (let row = 0; row < GRID_SIZE; row += 1) {
      for (let col = 0; col < GRID_SIZE; col += 1) {
        if (state.cellValues[row][col] === selectedValue) {
          sameValueCells.push([row, col]);
        }
      }
    }

    ctx.fillStyle = "rgba(0, 51, 102, 0.28)";
    sameValueCells.forEach(([row, col]) => {
      ctx.fillRect(
        metrics.offsetX + col * metrics.cellSize,
        metrics.offsetY,
        metrics.cellSize,
        metrics.boardSize
      );
      ctx.fillRect(
        metrics.offsetX,
        metrics.offsetY + row * metrics.cellSize,
        metrics.boardSize,
        metrics.cellSize
      );
      const blockRow = Math.floor(row / SQUARE_SIZE) * SQUARE_SIZE;
      const blockCol = Math.floor(col / SQUARE_SIZE) * SQUARE_SIZE;
      ctx.fillRect(
        metrics.offsetX + blockCol * metrics.cellSize,
        metrics.offsetY + blockRow * metrics.cellSize,
        metrics.cellSize * SQUARE_SIZE,
        metrics.cellSize * SQUARE_SIZE
      );
    });
  }

  drawGrid(ctx, metrics);

  for (let row = 0; row < GRID_SIZE; row += 1) {
    for (let col = 0; col < GRID_SIZE; col += 1) {
      const x1 = metrics.offsetX + col * metrics.cellSize;
      const y1 = metrics.offsetY + row * metrics.cellSize;
      const x2 = x1 + metrics.cellSize;
      const y2 = y1 + metrics.cellSize;
      const highlight =
        selectedValue && state.toggleHighlightLines && state.cellValues[row][col] === selectedValue;

      if (row === selectedRow && col === selectedCol) {
        ctx.strokeStyle = "yellow";
        ctx.lineWidth = 4;
        ctx.strokeRect(x1 + 2, y1 + 2, metrics.cellSize - 4, metrics.cellSize - 4);
      } else if (highlight) {
        ctx.strokeStyle = "#00bfff";
        ctx.lineWidth = 4;
        ctx.strokeRect(x1 + 2, y1 + 2, metrics.cellSize - 4, metrics.cellSize - 4);
      }

      const value = state.cellValues[row][col];
      if (value) {
        ctx.fillStyle = hasErrorCell(row, col) ? "red" : TEXT_COLOR;
        ctx.font = `700 ${Math.max(24, Math.floor(metrics.cellSize * 0.42))}px "JetBrains Mono", monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(value), (x1 + x2) / 2, (y1 + y2) / 2 + 1);
        continue;
      }

      if (!state.toggleShowHints) {
        continue;
      }

      ctx.font = `${Math.max(11, Math.floor(metrics.cellSize * 0.18))}px "JetBrains Mono", monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (let number = 1; number <= 9; number += 1) {
        if (!state.cellHints[row][col].has(number)) {
          continue;
        }
        const hintRow = Math.floor((number - 1) / 3);
        const hintCol = (number - 1) % 3;
        const centerX = x1 + ((hintCol + 0.5) * metrics.cellSize) / 3;
        const centerY = y1 + ((hintRow + 0.5) * metrics.cellSize) / 3;
        let color = HINT_COLOR;
        if (state.toggleHighlightAnswers) {
          if (state.cellHints[row][col].size === 1 || isSingleInSquare(row, col, number)) {
            color = HINT_SINGLE_COLOR;
          }
        }
        ctx.fillStyle = color;
        ctx.fillText(String(number), centerX, centerY);
      }
    }
  }
}

function onCanvasClick(event) {
  const metrics = getBoardMetrics();
  if (!metrics) {
    return;
  }

  const rect = refs.canvas.getBoundingClientRect();
  const x = event.clientX - rect.left - metrics.offsetX;
  const y = event.clientY - rect.top - metrics.offsetY;

  if (x < 0 || y < 0 || x >= metrics.boardSize || y >= metrics.boardSize) {
    return;
  }

  const col = Math.floor(x / metrics.cellSize);
  const row = Math.floor(y / metrics.cellSize);
  state.selected = [row, col];
  refs.canvas.focus();
  drawCells();
}

function clearAll() {
  state.cellValues = makeBlankBoard();
  state.solvedCache = null;
  state.solvedCacheField = null;
  setCompletionState(COMPLETION_STATE.IN_PROGRESS);
  state.errorCells = new Set();
  state.solutionMap = null;
  state.solutionMapReady = false;
  state.solutionMapField = null;
  hideCelebration();
  updateHints();
  checkAndUpdateErrors();
  drawCells();
  log("Очищено!");
}

function openInfoDialog() {
  if (typeof refs.infoDialog.showModal === "function") {
    refs.infoDialog.showModal();
    return;
  }
  refs.infoDialog.setAttribute("open", "");
}

function closeInfoDialog() {
  if (refs.infoDialog.open) {
    refs.infoDialog.close();
  }
}

async function generatePuzzle() {
  const result = await executeTimedOperation(
    "Генерация уровня",
    API.generate,
    {
      difficulty: state.difficultyVar
    },
    true
  );
  if (!result.ok) {
    handleApiFailure(result, "Не удалось сгенерировать головоломку.");
    return;
  }

  state.cellValues = normalizeBoard(result.data?.cellValues);
  state.solvedCache = normalizeBoard(result.data?.solvedCache);
  state.solvedCacheField = normalizeBoard(result.data?.solvedCacheField);
  state.solutionMap = normalizeBoard(result.data?.solutionMap);
  state.solutionMapReady = Boolean(result.data?.solutionMapReady);
  state.solutionMapField = normalizeBoard(result.data?.solutionMapField);
  setCompletionState(COMPLETION_STATE.IN_PROGRESS);
  state.errorCells = new Set();
  hideCelebration();
  updateHints();
  checkAndUpdateErrors();
  drawCells();
  logMultiline(result.message);
}

async function validateUserInput() {
  const result = await executeTimedOperation(
    "Валидация",
    API.validate,
    { board: state.cellValues },
    true
  );
  if (!result.ok) {
    state.solutionMap = null;
    state.solutionMapReady = false;
    state.solutionMapField = null;
    state.errorCells = new Set();
    drawCells();
    handleApiFailure(result, "Не удалось выполнить валидацию.");
    return;
  }

  state.solutionMap = normalizeBoard(result.data?.solutionMap);
  state.solutionMapReady = Boolean(result.data?.solutionMapReady);
  state.solutionMapField = copyBoard(state.cellValues);
  checkAndUpdateErrors();
  drawCells();
  logMultiline(result.message);
}

async function solvePuzzle() {
  const useCache = Boolean(state.solutionMapReady && state.solutionMap);
  const result = await executeTimedOperation(
    "Решение судоку",
    API.solve,
    {
      board: state.cellValues,
      solutionMap: state.solutionMap,
      solutionMapReady: state.solutionMapReady
    },
    !useCache
  );
  if (!result.ok) {
    handleApiFailure(result, "Решение не найдено.");
    return;
  }

  state.cellValues = normalizeBoard(result.data?.cellValues);
  state.solvedCache = normalizeBoard(result.data?.solvedCache);
  state.solvedCacheField = normalizeBoard(result.data?.solvedCacheField);
  setCompletionState(COMPLETION_STATE.AUTO_SOLVE);
  hideCelebration();
  updateHints();
  checkAndUpdateErrors();
  drawCells();
  logMultiline(result.message);
}

function hintCell() {
  const [row, col] = state.selected;
  if (state.cellValues[row][col]) {
    log(`Клетка (${row + 1},${col + 1}) уже заполнена`);
    return;
  }
  if (!state.solutionMapReady || !state.solutionMap) {
    log("Сначала запусти валидацию, пёс!");
    return;
  }

  const value = state.solutionMap[row][col];
  state.cellValues[row][col] = value;
  updateHints();
  checkAndUpdateErrors();
  drawCells();
  log(`Подсказка: для клетки (${row + 1},${col + 1}) значение - ${value}`);
}

function onKeyDown(event) {
  if (!state.initialized) {
    return;
  }
  if (refs.infoDialog.open) {
    return;
  }
  if (shouldIgnoreKeydown(event)) {
    return;
  }

  const [row, col] = state.selected;

  if (isEraseKey(event.key)) {
    event.preventDefault();
    if (state.completionState === COMPLETION_STATE.AUTO_SOLVE) {
      log(AUTO_SOLVE_INSULT_MESSAGE);
      return;
    }

    if (state.completionState === COMPLETION_STATE.MANUAL_WIN) {
      setCompletionState(COMPLETION_STATE.IN_PROGRESS);
      hideCelebration();
    }
    state.cellValues[row][col] = 0;
    updateHints();
    checkAndUpdateErrors();
    drawCells();
    return;
  }

  if (/^[1-9]$/.test(event.key)) {
    event.preventDefault();
    if (state.completionState === COMPLETION_STATE.AUTO_SOLVE) {
      return;
    }

    const nextValue = Number.parseInt(event.key, 10);
    if (state.cellValues[row][col] === nextValue) {
      return;
    }

    if (state.completionState === COMPLETION_STATE.MANUAL_WIN) {
      setCompletionState(COMPLETION_STATE.IN_PROGRESS);
      hideCelebration();
    }

    state.cellValues[row][col] = nextValue;
    updateHints();
    checkAndUpdateErrors();
    drawCells();
    if (checkWinCondition()) {
      completeManualWin();
    }
    return;
  }

  if (event.key === "ArrowUp") {
    event.preventDefault();
    state.selected = [(row - 1 + GRID_SIZE) % GRID_SIZE, col];
    drawCells();
  } else if (event.key === "ArrowDown") {
    event.preventDefault();
    state.selected = [(row + 1) % GRID_SIZE, col];
    drawCells();
  } else if (event.key === "ArrowLeft") {
    event.preventDefault();
    state.selected = [row, (col - 1 + GRID_SIZE) % GRID_SIZE];
    drawCells();
  } else if (event.key === "ArrowRight") {
    event.preventDefault();
    state.selected = [row, (col + 1) % GRID_SIZE];
    drawCells();
  }
}

function shouldIgnoreKeydown(event) {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  return ["INPUT", "SELECT", "TEXTAREA", "BUTTON"].includes(target.tagName);
}

function checkWinCondition() {
  let emptyCells = 0;
  for (let row = 0; row < GRID_SIZE; row += 1) {
    for (let col = 0; col < GRID_SIZE; col += 1) {
      if (state.cellValues[row][col] === 0) {
        emptyCells += 1;
      }
    }
  }
  if (emptyCells > 0) {
    return false;
  }

  for (let row = 0; row < GRID_SIZE; row += 1) {
    for (let col = 0; col < GRID_SIZE; col += 1) {
      const value = state.cellValues[row][col];
      if (value === 0) {
        return false;
      }

      for (let nextCol = 0; nextCol < GRID_SIZE; nextCol += 1) {
        if (nextCol !== col && state.cellValues[row][nextCol] === value) {
          log(`Дублирование ${value} в строке ${row + 1}`);
          return false;
        }
      }

      for (let nextRow = 0; nextRow < GRID_SIZE; nextRow += 1) {
        if (nextRow !== row && state.cellValues[nextRow][col] === value) {
          log(`Дублирование ${value} в столбце ${col + 1}`);
          return false;
        }
      }

      const blockRow = Math.floor(row / SQUARE_SIZE) * SQUARE_SIZE;
      const blockCol = Math.floor(col / SQUARE_SIZE) * SQUARE_SIZE;
      for (let deltaRow = 0; deltaRow < SQUARE_SIZE; deltaRow += 1) {
        for (let deltaCol = 0; deltaCol < SQUARE_SIZE; deltaCol += 1) {
          const nextRow = blockRow + deltaRow;
          const nextCol = blockCol + deltaCol;
          if ((nextRow !== row || nextCol !== col) && state.cellValues[nextRow][nextCol] === value) {
            log(`Дублирование ${value} в квадрате (${Math.floor(blockRow / 3) + 1},${Math.floor(blockCol / 3) + 1})`);
            return false;
          }
        }
      }
    }
  }

  return true;
}

function clearLog() {
  refs.log.textContent = "";
}

async function copyLog() {
  const logText = Array.from(refs.log.querySelectorAll(".sudoku-log-line"))
    .map((line) => line.textContent ?? "")
    .join("\n");

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(logText);
    } else {
      const helper = document.createElement("textarea");
      helper.value = logText;
      helper.setAttribute("readonly", "");
      helper.style.position = "absolute";
      helper.style.left = "-9999px";
      document.body.append(helper);
      helper.select();
      document.execCommand("copy");
      helper.remove();
    }
    log("Лог скопирован в буфер обмена.");
  } catch (_error) {
    log("Не удалось скопировать лог.");
  }
}

function saveLog() {
  const logText = Array.from(refs.log.querySelectorAll(".sudoku-log-line"))
    .map((line) => line.textContent ?? "")
    .join("\n");
  const fileName = "sudoku-log.txt";
  const blob = new Blob([logText], { type: "text/plain;charset=utf-8" });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
  log(`Лог сохранён в файл: ${fileName}`);
}

function toggleConsole() {
  state.consoleVisible = !state.consoleVisible;
  applyConsoleVisibility();
}

function applyConsoleVisibility() {
  refs.log.classList.toggle("is-hidden", !state.consoleVisible);
  refs.toggleLogButton.textContent = state.consoleVisible ? "Скрыть лог" : "Показать лог";
}

function log(message) {
  const line = document.createElement("div");
  line.className = "sudoku-log-line";

  const time = document.createElement("span");
  time.className = "sudoku-log-time";
  time.textContent = `[${formatTime(new Date())}]`;

  const text = document.createElement("span");
  text.textContent = message;

  line.append(time, text);
  refs.log.append(line);
  refs.log.scrollTop = refs.log.scrollHeight;
}

function logMultiline(message) {
  if (!message) {
    return;
  }
  String(message)
    .split("\n")
    .forEach((line) => log(line));
}

function formatTime(date) {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

function startProgress(taskName) {
  stopProgress();
  const startedAt = performance.now();
  state.progress = {
    taskName,
    startedAt,
    intervalId: window.setInterval(() => {
      const elapsed = performance.now() - startedAt;
      const ms = Math.max(0, Math.floor(elapsed));
      const filled = (Math.floor(elapsed / 1000) % 10) + 1;
      const bar = `${"■".repeat(filled)}${" ".repeat(Math.max(0, 10 - filled))}`;
      log(`${taskName}: [${bar}] ${ms} мс`);
    }, 100)
  };
}

function stopProgress() {
  if (!state.progress) {
    return;
  }
  window.clearInterval(state.progress.intervalId);
  state.progress = null;
}

async function executeTimedOperation(taskName, url, body, showProgress) {
  const controller = new AbortController();
  let timeoutId = null;

  if (showProgress) {
    startProgress(taskName);
    timeoutId = window.setTimeout(() => {
      controller.abort();
    }, 10500);
  }

  const result = await apiRequest(url, {
    method: "POST",
    body,
    signal: controller.signal
  });

  if (timeoutId !== null) {
    window.clearTimeout(timeoutId);
  }
  if (showProgress) {
    stopProgress();
  }

  if (result.aborted) {
    log(`Операция "${taskName}" прервана по таймауту!`);
  }
  return result;
}

function handleApiFailure(result, fallbackMessage) {
  const message = result?.message || fallbackMessage;
  if (result?.status === 404) {
    showStatus(message || FEATURE_GONE_MESSAGE);
    setControlsDisabled(true);
  }
  if (message) {
    logMultiline(message);
  }
}

async function apiRequest(url, options = {}) {
  const fetchOptions = {
    method: options.method || "GET",
    signal: options.signal,
    headers: {}
  };

  if (options.body !== undefined) {
    fetchOptions.body = JSON.stringify(options.body);
    fetchOptions.headers["Content-Type"] = "application/json";
  }

  try {
    const response = await fetch(url, fetchOptions);
    let payload = null;
    try {
      payload = await response.json();
    } catch (_error) {
      payload = null;
    }

    if (response.status === 404) {
      return {
        ok: false,
        status: 404,
        message: payload?.message || FEATURE_GONE_MESSAGE
      };
    }

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: payload?.message || "Ошибка Sudoku."
      };
    }

    if (!payload || typeof payload !== "object") {
      return {
        ok: false,
        status: response.status,
        message: "Не удалось получить ответ от Sudoku."
      };
    }

    return {
      ok: Boolean(payload.ok),
      status: response.status,
      data: payload.data || null,
      message: payload.message || ""
    };
  } catch (error) {
    if (error?.name === "AbortError") {
      return {
        ok: false,
        aborted: true,
        message: ""
      };
    }
    return {
      ok: false,
      status: 0,
      message: "Не удалось связаться с Sudoku."
    };
  }
}
