const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

const isDev = !app.isPackaged;

let mainWindow = null;
let characterWindow = null;

let isQuitting = false;

app.on('before-quit', () => {
  isQuitting = true;
});

let selectedCharacter = 'pomeranian';
let customRig = null;
let characterSize = null;
let characterMouseIgnored = false;

// macOS/Windows support forwarding mouse movements while click-through is on.
const supportsClickThrough = process.platform === 'darwin' || process.platform === 'win32';

function setCharacterMouseIgnored(ignore) {
  if (!supportsClickThrough || !characterWindow || characterWindow.isDestroyed()) return;
  if (characterMouseIgnored === ignore) return;
  characterMouseIgnored = ignore;
  characterWindow.setIgnoreMouseEvents(ignore, { forward: true });
}

ipcMain.on('character:mouse-ignore', (event, ignore) => {
  if (event.sender !== characterWindow?.webContents || typeof ignore !== 'boolean') return;
  setCharacterMouseIgnored(ignore);
});

// Mouse movement alone misses animation under a stationary cursor.
// Only send window-local coordinates when the cursor is inside the pet window.
function watchCharacterCursor(win) {
  if (!supportsClickThrough) return;
  let wasInside = false;
  const timer = setInterval(() => {
    if (win.isDestroyed() || !win.isVisible() || win.webContents.isDestroyed()) return;
    const point = screen.getCursorScreenPoint();
    const bounds = win.getContentBounds();
    const x = point.x - bounds.x;
    const y = point.y - bounds.y;
    const inside = x >= 0 && y >= 0 && x < bounds.width && y < bounds.height;
    if (inside) {
      win.webContents.send('character:cursor', { x, y });
    } else if (wasInside) {
      win.webContents.send('character:cursor', null);
    }
    wasInside = inside;
  }, 33);
  win.once('closed', () => clearInterval(timer));
}

const BASE_CHARACTER_WIDTH = 360;
const BASE_CHARACTER_HEIGHT = 400;

function isValidCharacterSize(size) {
  return typeof size === 'number' &&
    Number.isFinite(size) && size >= 50 && size <= 200;
}

function characterSizePath() {
  return path.join(app.getPath('userData'), 'character-size.json');
}

function loadCharacterSize() {
  try {
    const { size } = JSON.parse(fs.readFileSync(characterSizePath(), 'utf8'));
    return isValidCharacterSize(size) ? size : null;
  } catch {
    return null;
  }
}

function saveCharacterSize(size) {
  try {
    const filename = characterSizePath();
    fs.mkdirSync(path.dirname(filename), { recursive: true });
    fs.writeFileSync(filename + '.tmp', JSON.stringify({ size }), 'utf8');
    fs.renameSync(filename + '.tmp', filename);
  } catch (error) {
    console.warn('캐릭터 크기 저장 실패:', error);
  }
}

function getCharacterDimensions(size = characterSize ?? 100) {
  return {
    width: Math.round(BASE_CHARACTER_WIDTH * size / 100),
    height: Math.round(BASE_CHARACTER_HEIGHT * size / 100),
  };
}

// Electron이 크기 설정의 기준이며, 최초 실행 시 기존 웹 설정을 가져온다.
ipcMain.handle('character:size-get', () => characterSize);

ipcMain.on('character:size-set', (event, size) => {
  if (event.sender !== mainWindow?.webContents) return;
  if (!isValidCharacterSize(size)) return;
  if (size === characterSize) return;

  characterSize = size;
  saveCharacterSize(size);

  if (characterWindow && !characterWindow.isDestroyed()) {
    const { width, height } = getCharacterDimensions(size);
    characterWindow.setContentSize(width, height);
    characterWindow.webContents.send('character:size-changed', size);
  }
});

const validCharacters = [
  'basic',
  'illustration',
  'pomeranian',
  'custom',
];

// ========================================
// 캐릭터 선택 동기화
// ========================================

ipcMain.on('character:select', (_event, characterType) => {
  if (!validCharacters.includes(characterType)) return;

  selectedCharacter = characterType;

  characterWindow?.webContents.send(
    'character:changed',
    selectedCharacter
  );
});

ipcMain.handle('character:get', () => {
  return selectedCharacter;
});

// ========================================
// 커스텀 캐릭터 리깅 데이터 동기화
// ========================================

ipcMain.on('character:custom-rig', (_event, rig) => {
  if (!rig || typeof rig !== 'object') return;
  if (!Array.isArray(rig.parts)) return;

  customRig = rig;

  if (characterWindow && !characterWindow.isDestroyed()) {
    characterWindow.webContents.send(
      'character:custom-rig-changed',
      customRig
    );
  }
});

ipcMain.handle('character:custom-rig-get', () => {
  return customRig;
});

// ========================================
// AI 감정 및 애니메이션 동기화
// ========================================

ipcMain.on('character:reaction', (_event, reactionState) => {
  if (!reactionState || typeof reactionState !== 'object') return;

  characterWindow?.webContents.send(
    'character:reaction-changed',
    reactionState
  );
});

// ========================================
// 채팅창 열기 및 숨기기
// ========================================

ipcMain.on('chat:toggle', () => {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  if (mainWindow.isVisible()) {
    mainWindow.hide();
  } else {
    mainWindow.show();
    mainWindow.focus();
  }
});

// ========================================
// 데스크톱 캐릭터 위치 이동
// ========================================

ipcMain.on('character:move', (_event, position) => {
  if (!characterWindow || characterWindow.isDestroyed()) return;
  if (!position) return;

  const { dx, dy } = position;

  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return;

  const [x, y] = characterWindow.getPosition();

  characterWindow.setPosition(
    Math.round(x + dx),
    Math.round(y + dy)
  );
});

// ========================================
// 채팅창 생성
// ========================================

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 800,
    minWidth: 700,
    minHeight: 500,
    title: 'Step1 - AI Companion',

    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(
      path.join(__dirname, '../dist/index.html')
    );
  }

 // 채팅창 닫기 대신 숨기기
mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
  
  // 프로그램 실제 종료
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ========================================
// 데스크톱 캐릭터 창 생성
// ========================================

function createCharacterWindow() {
  const { width, height } = getCharacterDimensions();
  characterWindow = new BrowserWindow({
    width,
    height,
    useContentSize: true,
    x: 100,
    y: 100,

    frame: false,
    transparent: true,
    backgroundColor: '#00000000',

    alwaysOnTop: true,
    resizable: false,
    hasShadow: false,

    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  characterMouseIgnored = false;
  setCharacterMouseIgnored(true);
  characterWindow.webContents.on('did-start-loading', () => setCharacterMouseIgnored(true));
  characterWindow.webContents.on('render-process-gone', () => setCharacterMouseIgnored(true));
  watchCharacterCursor(characterWindow);

  if (isDev) {
    characterWindow.loadURL(
      'http://localhost:5173/?mode=character'
    );
  } else {
    characterWindow.loadFile(
      path.join(__dirname, '../dist/index.html'),
      { query: { mode: 'character' } }
    );
  }

  characterWindow.on('closed', () => {
    characterWindow = null;
  });
}

// ========================================
// Electron 실행
// ========================================

app.whenReady().then(() => {
  characterSize = loadCharacterSize();
  createMainWindow();
  createCharacterWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
      createCharacterWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
