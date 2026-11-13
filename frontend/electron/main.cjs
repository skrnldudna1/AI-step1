const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');

const isDev = !app.isPackaged;

let mainWindow = null;
let characterWindow = null;

let selectedCharacter = 'pomeranian';

const validCharacters = [
  'basic',
  'illustration',
  'pomeranian',
];

ipcMain.on('character:select', (_event, characterType) => {
  if (!validCharacters.includes(characterType)) return;

  selectedCharacter = characterType;

  characterWindow?.webContents.send(
    'character:changed',
    selectedCharacter
  );
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

ipcMain.handle('character:get', () => {
  return selectedCharacter;
});

// 기존 Step1 채팅창
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

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// 포메라니안 전용 투명 창
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