const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');

const isDev = !app.isPackaged;

let mainWindow = null;
let characterWindow = null;

let isQuitting = false;

app.on('before-quit', () => {
  isQuitting = true;
});

let selectedCharacter = 'pomeranian';

const validCharacters = [
  'basic',
  'illustration',
  'pomeranian',
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
  characterWindow = new BrowserWindow({
    width: 360,
    height: 400,
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