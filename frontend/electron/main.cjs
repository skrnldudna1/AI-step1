const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { createChatSession } = require('./chatSession.cjs');
const { getPopupBounds, getDetachedPopupBounds } = require('./popupBounds.cjs');
const { characterTypes, validateProfile, normalizeProfiles } = require('./persona.cjs');

const isDev = !app.isPackaged;

let mainWindow = null;
let characterWindow = null;
let chatWindow = null;
let chatOpenRequested = false;
let chatReady = false;
let chatFollowsCharacter = true;
let detachedChatPosition = null;

let isQuitting = false;

app.on('before-quit', () => {
  isQuitting = true;
  saveChatLayout();
  chatSession.dispose();
});

function notify(win, channel, data) {
  if (win && !win.isDestroyed() && !win.webContents.isDestroyed()) {
    win.webContents.send(channel, data);
  }
}

const chatSession = createChatSession({
  async request(message, profile) {
    const response = await fetch('http://127.0.0.1:8000/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, profile }),
      signal: AbortSignal.timeout(60000),
    });
    if (!response.ok) throw new Error(`채팅 요청 실패: ${response.status}`);
    const result = await response.json();
    // Preserve the existing thinking animation even for quick mock replies.
    await new Promise((resolve) => setTimeout(resolve, 2000));
    return result;
  },
  publishChat(state) {
    notify(mainWindow, 'chat:state-changed', state);
    notify(chatWindow, 'chat:state-changed', state);
  },
  publishReaction(state) {
    notify(mainWindow, 'character:reaction-changed', state);
    notify(characterWindow, 'character:reaction-changed', state);
  },
});

function isChatSender(event) {
  return event.sender === mainWindow?.webContents || event.sender === chatWindow?.webContents;
}

ipcMain.handle('chat:state-get', (event) => {
  if (!isChatSender(event)) return null;
  return chatSession.getChat();
});
ipcMain.handle('chat:submit', (event, message) => {
  if (!isChatSender(event)) return false;
  return chatSession.submit(message);
});
ipcMain.handle('character:reaction-get', (event) => {
  if (event.sender !== mainWindow?.webContents &&
      event.sender !== characterWindow?.webContents) return null;
  return chatSession.getReaction();
});
ipcMain.on('character:reaction-update', (event, patch) => {
  if (event.sender !== mainWindow?.webContents) return;
  chatSession.updateReaction(patch);
});

let selectedCharacter = 'pomeranian';
let characterProfiles = normalizeProfiles(null);
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

function profilesPath() {
  return path.join(app.getPath('userData'), 'character-profiles.json');
}

function loadProfiles() {
  try {
    characterProfiles = normalizeProfiles(JSON.parse(fs.readFileSync(profilesPath(), 'utf8')));
  } catch {
    characterProfiles = normalizeProfiles(null);
  }
}

function saveProfiles(profiles) {
  try {
    const filename = profilesPath();
    fs.mkdirSync(path.dirname(filename), { recursive: true });
    fs.writeFileSync(filename + '.tmp', JSON.stringify(profiles), 'utf8');
    fs.renameSync(filename + '.tmp', filename);
    return true;
  } catch (error) {
    console.warn('캐릭터 프로필 저장 실패:', error.message);
    return false;
  }
}

function personaState() {
  return { characterType: selectedCharacter, profiles: characterProfiles };
}

function publishPersona() {
  chatSession.setProfile(characterProfiles[selectedCharacter]);
  const state = personaState();
  notify(mainWindow, 'persona:changed', state);
  notify(chatWindow, 'persona:changed', state);
  notify(characterWindow, 'persona:changed', state);
}

ipcMain.handle('persona:get', (event) => {
  if (!isChatSender(event) && event.sender !== characterWindow?.webContents) return null;
  return personaState();
});

ipcMain.handle('persona:set', (event, type, profile) => {
  if (event.sender !== mainWindow?.webContents || !characterTypes.includes(type)) return false;
  const valid = validateProfile(profile);
  if (!valid) return false;
  const next = { ...characterProfiles, [type]: valid };
  if (!saveProfiles(next)) return false;
  characterProfiles = next;
  publishPersona();
  return true;
});

function chatLayoutPath() {
  return path.join(app.getPath('userData'), 'mini-chat-layout.json');
}

function isValidPoint(point) {
  return point && Number.isFinite(point.x) && Number.isFinite(point.y) &&
    Math.abs(point.x) < 100000 && Math.abs(point.y) < 100000;
}

function loadChatLayout() {
  try {
    const layout = JSON.parse(fs.readFileSync(chatLayoutPath(), 'utf8'));
    if (typeof layout.follow !== 'boolean') return;
    if (isValidPoint(layout.position)) detachedChatPosition = layout.position;
    chatFollowsCharacter = layout.follow || !detachedChatPosition;
  } catch {
    // First launch or a damaged preference: retain the default attached mode.
  }
}

function saveChatLayout() {
  try {
    const filename = chatLayoutPath();
    fs.mkdirSync(path.dirname(filename), { recursive: true });
    fs.writeFileSync(filename + '.tmp', JSON.stringify({
      follow: chatFollowsCharacter,
      position: detachedChatPosition,
    }), 'utf8');
    fs.renameSync(filename + '.tmp', filename);
  } catch (error) {
    console.warn('미니 채팅창 위치 저장 실패:', error.message);
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
    positionChatWindow();
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

ipcMain.on('character:select', (event, characterType) => {
  if (event.sender !== mainWindow?.webContents || !validCharacters.includes(characterType)) return;

  selectedCharacter = characterType;
  publishPersona();

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

// ========================================
// 독립 채팅 팝업 열기 및 숨기기
// ========================================

function positionChatWindow() {
  if (!chatFollowsCharacter) return;
  if (!chatWindow || chatWindow.isDestroyed() ||
      !characterWindow || characterWindow.isDestroyed()) return;
  const pet = characterWindow.getBounds();
  const display = screen.getDisplayMatching(pet);
  const bounds = getPopupBounds(pet, display.workArea);
  const current = chatWindow.getBounds();
  if (Object.keys(bounds).some((key) => current[key] !== bounds[key])) {
    chatWindow.setBounds(bounds, false);
  }
}

function getDetachedBounds(position) {
  const display = screen.getDisplayMatching({ ...position, width: 360, height: 420 });
  return getDetachedPopupBounds(position, display.workArea);
}

function rememberDetachedPosition() {
  if (!chatWindow || chatWindow.isDestroyed()) return;
  const { x, y } = chatWindow.getBounds();
  detachedChatPosition = { x, y };
}

function keepChatOnScreen() {
  if (chatFollowsCharacter) {
    positionChatWindow();
    return;
  }
  if (!chatWindow || chatWindow.isDestroyed()) return;
  const bounds = getDetachedBounds(detachedChatPosition ?? chatWindow.getBounds());
  const current = chatWindow.getBounds();
  if (Object.keys(bounds).some(key => current[key] !== bounds[key])) {
    chatWindow.setBounds(bounds, false);
  }
  rememberDetachedPosition();
}

function setChatFollow(follow, persist = true) {
  if (follow === chatFollowsCharacter) return;
  if (!follow) rememberDetachedPosition();
  chatFollowsCharacter = follow;
  notify(chatWindow, 'chat:follow-changed', follow);
  if (follow) positionChatWindow();
  if (persist) saveChatLayout();
}

ipcMain.handle('chat:follow-get', (event) => {
  return event.sender === chatWindow?.webContents ? chatFollowsCharacter : null;
});

ipcMain.on('chat:follow-set', (event, follow) => {
  if (event.sender !== chatWindow?.webContents || typeof follow !== 'boolean') return;
  setChatFollow(follow);
});

ipcMain.on('chat:move', (event, position) => {
  if (event.sender !== chatWindow?.webContents || chatWindow.isDestroyed() || !position) return;
  const { dx, dy } = position;
  if (!Number.isFinite(dx) || !Number.isFinite(dy) ||
      Math.abs(dx) > 10000 || Math.abs(dy) > 10000 || (!dx && !dy)) return;
  // A real header drag detaches the popup before changing its native position.
  setChatFollow(false, false);
  const { x, y } = chatWindow.getBounds();
  chatWindow.setPosition(Math.round(x + dx), Math.round(y + dy));
  rememberDetachedPosition();
});

ipcMain.on('chat:move-end', (event) => {
  if (event.sender !== chatWindow?.webContents || chatFollowsCharacter) return;
  keepChatOnScreen();
  saveChatLayout();
});

function showChatWindow() {
  if (!characterWindow || characterWindow.isDestroyed()) return;
  chatOpenRequested = true;
  if (!chatWindow || chatWindow.isDestroyed()) createChatWindow();
  keepChatOnScreen();
  if (chatReady) {
    chatWindow.show();
    chatWindow.focus();
  }
}

function hideChatWindow() {
  chatOpenRequested = false;
  if (!chatFollowsCharacter) {
    keepChatOnScreen();
    saveChatLayout();
  }
  if (chatWindow && !chatWindow.isDestroyed()) chatWindow.hide();
}

ipcMain.on('chat:toggle', (event) => {
  if (event.sender !== characterWindow?.webContents) return;
  if (chatOpenRequested) hideChatWindow();
  else showChatWindow();
});
ipcMain.on('chat:open', (event) => {
  if (event.sender === mainWindow?.webContents) showChatWindow();
});
ipcMain.on('chat:hide', (event) => {
  if (event.sender === chatWindow?.webContents) hideChatWindow();
});
ipcMain.on('settings:open', (event) => {
  if (event.sender !== chatWindow?.webContents) return;
  hideChatWindow();
  if (!mainWindow || mainWindow.isDestroyed()) createMainWindow();
  mainWindow.show();
  mainWindow.focus();
});

function createChatWindow() {
  chatReady = false;
  const pet = characterWindow.getBounds();
  const bounds = !chatFollowsCharacter && detachedChatPosition
    ? getDetachedBounds(detachedChatPosition)
    : getPopupBounds(pet, screen.getDisplayMatching(pet).workArea);
  const win = new BrowserWindow({
    ...bounds,
    show: false,
    title: 'Step1 - Mini Chat',
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    acceptFirstMouse: true,
    resizable: false,
    backgroundColor: '#f8f7f4',
    hasShadow: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });
  chatWindow = win;
  win.once('ready-to-show', () => {
    chatReady = true;
    if (chatOpenRequested) {
      keepChatOnScreen();
      win.show();
      win.focus();
    }
  });
  win.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      hideChatWindow();
    }
  });
  win.on('closed', () => {
    if (chatWindow === win) {
      chatWindow = null;
      chatReady = false;
      chatOpenRequested = false;
    }
  });
  const load = isDev
    ? win.loadURL('http://localhost:5173/?mode=chat')
    : win.loadFile(path.join(__dirname, '../dist/index.html'), { query: { mode: 'chat' } });
  load.catch((error) => {
    console.error('미니 채팅창 로드 실패:', error.message);
    if (!win.isDestroyed()) win.destroy();
  });
}

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
  positionChatWindow();
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
    acceptFirstMouse: true,
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
  characterWindow.on('move', positionChatWindow);
  characterWindow.on('resize', positionChatWindow);

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
    if (chatWindow && !chatWindow.isDestroyed()) chatWindow.destroy();
  });
}

// ========================================
// Electron 실행
// ========================================

app.whenReady().then(() => {
  characterSize = loadCharacterSize();
  loadChatLayout();
  loadProfiles();
  chatSession.setProfile(characterProfiles[selectedCharacter]);
  createMainWindow();
  createCharacterWindow();
  screen.on('display-metrics-changed', keepChatOnScreen);
  screen.on('display-removed', keepChatOnScreen);

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
