const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const electronDir = path.resolve(__dirname, '..');

async function setup(storedFiles = new Map()) {
  const windows = [];
  const handlers = new Map();
  const ipcMain = new EventEmitter();
  ipcMain.handle = (name, handler) => handlers.set(name, handler);
  const app = new EventEmitter();
  app.isPackaged = false;
  app.whenReady = () => Promise.resolve();
  app.getPath = () => '/mock-profile';
  const screen = new EventEmitter();
  screen.workArea = { x: 0, y: 0, width: 1500, height: 1000 };
  screen.getDisplayMatching = () => ({ workArea: screen.workArea });
  screen.getCursorScreenPoint = () => ({ x: 0, y: 0 });
  let requests = 0;
  let lastRequest;
  let reply;
  const backend = new Promise(resolve => { reply = resolve; });
  class BrowserWindow extends EventEmitter {
    constructor(options) {
      super();
      this.options = options;
      this.bounds = { x: options.x ?? 0, y: options.y ?? 0, width: options.width, height: options.height };
      this.visible = options.show !== false;
      this.destroyed = false;
      this.webContents = new EventEmitter();
      this.webContents.isDestroyed = () => this.destroyed;
      this.webContents.send = () => {};
      windows.push(this);
    }
    static getAllWindows() { return windows.filter(win => !win.destroyed); }
    loadURL(url) { this.url = url; return Promise.resolve(); }
    isDestroyed() { return this.destroyed; }
    isVisible() { return this.visible; }
    show() { this.visible = true; }
    hide() { this.visible = false; }
    focus() { this.focused = true; }
    getBounds() { return this.bounds; }
    getContentBounds() { return this.bounds; }
    getPosition() { return [this.bounds.x, this.bounds.y]; }
    setPosition(x, y) { this.bounds = { ...this.bounds, x, y }; this.emit('move'); }
    setContentSize(width, height) { this.bounds = { ...this.bounds, width, height }; this.emit('resize'); }
    setBounds(bounds) { this.bounds = { ...bounds }; }
    setIgnoreMouseEvents(ignore) { this.ignore = ignore; }
    destroy() { this.destroyed = true; this.emit('closed'); }
  }
  const electron = { app, screen, BrowserWindow, ipcMain };
  vm.runInNewContext(fs.readFileSync(path.join(electronDir, 'main.cjs'), 'utf8'), {
    require: name => {
      if (name === 'electron') return electron;
      if (name === 'node:fs') return {
        readFileSync(filename) {
          if (!storedFiles.has(filename)) throw new Error('no previous preference');
          return storedFiles.get(filename);
        },
        mkdirSync() {},
        writeFileSync(filename, contents) { storedFiles.set(filename, contents); },
        renameSync(from, to) { storedFiles.set(to, storedFiles.get(from)); storedFiles.delete(from); },
      };
      return name.startsWith('./') ? require(path.resolve(electronDir, name)) : require(name);
    },
    __dirname: electronDir,
    process: { platform: 'darwin' },
    console, AbortSignal,
    setInterval: () => 1, clearInterval() {},
    setTimeout: fn => queueMicrotask(fn),
    fetch: async (_url, options) => {
      requests++;
      lastRequest = JSON.parse(options.body);
      assert.equal(lastRequest.message, '공유 메시지');
      const response = await backend;
      return { ok: true, json: async () => response };
    },
  });
  await Promise.resolve();
  const bridge = (win) => {
    let api;
    const renderer = new EventEmitter();
    renderer.send = (name, ...args) => ipcMain.emit(name, { sender: win.webContents }, ...args);
    renderer.invoke = async (name, ...args) => handlers.get(name)({ sender: win.webContents }, ...args);
    win.webContents.send = (name, ...args) => renderer.emit(name, {}, ...args);
    vm.runInNewContext(fs.readFileSync(path.join(electronDir, 'preload.cjs'), 'utf8'), {
      require: name => name === 'electron' ? {
        ipcRenderer: renderer,
        contextBridge: { exposeInMainWorld: (_name, value) => { api = value; } },
      } : require(name),
    });
    return api;
  };
  return { app, screen, windows, bridge, reply, storedFiles, requestCount: () => requests, getLastRequest: () => lastRequest };
}

test('pet opens one popup, follows size and move, and shares one chat with settings', async () => {
  const { app, windows, bridge, reply, requestCount } = await setup();
  try {
    const [settings, pet] = windows;
    const settingsAPI = bridge(settings);
    const petAPI = bridge(pet);
    petAPI.toggleChat();
    assert.equal(windows.length, 3);
    const popup = windows[2];
    assert.match(popup.url, /mode=chat/);
    assert.equal(popup.visible, false);
    // Double click while loading should not unexpectedly show the popup.
    petAPI.toggleChat();
    popup.emit('ready-to-show');
    assert.equal(popup.visible, false);
    const popupAPI = bridge(popup);
    petAPI.toggleChat();
    assert.equal(popup.visible, true);
    assert.equal(settings.visible, true);
    assert.equal(popup.bounds.x, pet.bounds.x + pet.bounds.width + 8);
    petAPI.moveCharacter({ dx: 100, dy: 50 });
    assert.equal(popup.bounds.x, pet.bounds.x + pet.bounds.width + 8);
    settingsAPI.setCharacterSize(150);
    assert.equal(pet.bounds.width, 540);
    assert.equal(popup.bounds.x, pet.bounds.x + pet.bounds.width + 8);

    const settingsChats = [];
    const popupChats = [];
    const reactions = [];
    settingsAPI.onChatStateChanged(state => settingsChats.push(state));
    popupAPI.onChatStateChanged(state => popupChats.push(state));
    petAPI.onReactionChanged(state => reactions.push(state));
    assert.deepEqual(await settingsAPI.getChatState(), await popupAPI.getChatState());
    assert.equal(await petAPI.submitChatMessage('not allowed'), false);
    assert.equal(await popupAPI.submitChatMessage('공유 메시지'), true);
    assert.equal(await settingsAPI.submitChatMessage('duplicate'), false);
    assert.equal(requestCount(), 1);
    assert.equal(reactions.at(-1).isThinking, true);
    popupAPI.hideChat();
    assert.equal(popup.visible, false);
    reply({ reply: '공유 응답', reaction: { emotion: 'happy', action: 'idle', intensity: 1 } });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(settingsChats.at(-1).messages.at(-1).content, '공유 응답');
    assert.equal(popupChats.at(-1).messages.at(-1).content, '공유 응답');
    assert.equal(reactions.at(-1).isTalking, true);
    settingsAPI.openChat();
    assert.equal(popup.visible, true);
    assert.equal(windows.length, 3);
    popupAPI.openSettings();
    assert.equal(popup.visible, false);
    assert.equal(settings.visible, true);
    assert.equal(settings.focused, true);
    assert.equal((await popupAPI.getChatState()).messages.length, 3);
    settingsAPI.updateReaction({ action: 'nod' });
    assert.equal((await petAPI.getReactionState()).reaction.action, 'nod');
  } finally {
    app.emit('before-quit');
  }
});

test('per-character profiles sync into the popup and backend body, survive restart, and reject invalid edits', async () => {
  const files = new Map();
  const first = await setup(files);
  const { app, windows, bridge, reply, getLastRequest } = first;
  try {
    const mainAPI = bridge(windows[0]);
    const petAPI = bridge(windows[1]);
    mainAPI.selectCharacter('basic');
    petAPI.toggleChat();
    const popupAPI = bridge(windows[2]);
    const before = await mainAPI.getPersonaState();
    const profile = { name: '별이', personality: 'playful', tone: 'polite' };
    const states = [];
    popupAPI.onPersonaChanged(state => states.push(state));
    assert.equal(await popupAPI.setCharacterProfile('basic', profile), false);
    assert.equal(await mainAPI.setCharacterProfile('bad', profile), false);
    assert.equal(await mainAPI.setCharacterProfile('basic', { ...profile, tone: 'unknown' }), false);
    assert.equal(await mainAPI.setCharacterProfile('basic', profile), true);
    assert.deepEqual(states.at(-1).profiles.basic, profile);
    assert.deepEqual(states.at(-1).profiles.pomeranian, before.profiles.pomeranian);
    assert.equal((await popupAPI.getChatState()).messages[0].senderName, '별이');
    assert.equal(await popupAPI.submitChatMessage('공유 메시지'), true);
    assert.deepEqual(getLastRequest().profile, profile);
    mainAPI.selectCharacter('pomeranian');
    assert.equal((await popupAPI.getPersonaState()).characterType, 'pomeranian');
    reply({ reply: '안녕하세요!', reaction: { emotion: 'happy', action: 'idle', intensity: 0.6 } });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal((await popupAPI.getChatState()).messages.at(-1).senderName, '별이');
  } finally {
    app.emit('before-quit');
  }
  const restarted = await setup(files);
  try {
    const mainAPI = restarted.bridge(restarted.windows[0]);
    assert.equal((await mainAPI.getPersonaState()).profiles.basic.name, '별이');
    assert.equal((await mainAPI.getPersonaState()).profiles.pomeranian.name, '포미');
  } finally {
    restarted.app.emit('before-quit');
  }
});

test('drag detaches popup, pet moves independently, and reconnect restores following', async () => {
  const { app, screen, windows, bridge, storedFiles } = await setup();
  try {
    const [settings, pet] = windows;
    const settingsAPI = bridge(settings);
    const petAPI = bridge(pet);
    petAPI.toggleChat();
    const popup = windows[2];
    const popupAPI = bridge(popup);
    popup.emit('ready-to-show');
    const changes = [];
    popupAPI.onChatFollowChanged(follow => changes.push(follow));
    assert.equal(await popupAPI.getChatFollow(), true);
    assert.equal(await petAPI.getChatFollow(), null);
    const original = { ...popup.bounds };
    // Non-chat windows must not be able to detach or move the popup.
    petAPI.setChatFollow(false);
    petAPI.moveChatWindow({ dx: 50, dy: 30 });
    popupAPI.moveChatWindow({ dx: 0, dy: 0 });
    assert.equal(await popupAPI.getChatFollow(), true);
    assert.deepEqual(popup.bounds, original);

    popupAPI.moveChatWindow({ dx: 120, dy: 80 });
    popupAPI.finishChatMove();
    assert.equal(await popupAPI.getChatFollow(), false);
    assert.deepEqual(changes, [false]);
    assert.deepEqual(popup.bounds, { ...original, x: original.x + 120, y: original.y + 80 });
    const detached = { ...popup.bounds };
    petAPI.moveCharacter({ dx: 100, dy: 40 });
    settingsAPI.setCharacterSize(150);
    assert.deepEqual(popup.bounds, detached);
    popupAPI.hideChat();
    petAPI.toggleChat();
    assert.deepEqual(popup.bounds, detached);
    assert.equal(popup.visible, true);
    const saved = JSON.parse(storedFiles.get('/mock-profile/mini-chat-layout.json'));
    assert.deepEqual(saved, { follow: false, position: { x: detached.x, y: detached.y } });

    // Display changes keep the detached popup visible without linking it to the pet.
    screen.workArea = { x: 0, y: 20, width: 800, height: 600 };
    screen.emit('display-removed');
    assert.ok(popup.bounds.x + popup.bounds.width <= 800);
    assert.ok(popup.bounds.y + popup.bounds.height <= 620);
    assert.equal(await popupAPI.getChatFollow(), false);

    screen.workArea = { x: 0, y: 0, width: 1500, height: 1000 };
    popupAPI.setChatFollow(true);
    assert.equal(await popupAPI.getChatFollow(), true);
    assert.deepEqual(changes, [false, true]);
    assert.equal(popup.bounds.x, pet.bounds.x + pet.bounds.width + 8);
    const attached = { ...popup.bounds };
    petAPI.moveCharacter({ dx: 25, dy: 0 });
    assert.equal(popup.bounds.x, attached.x + 25);
  } finally {
    app.emit('before-quit');
  }
});

test('saved free-move mode and position are restored in a new Electron session', async () => {
  const files = new Map();
  const first = await setup(files);
  const firstPet = first.bridge(first.windows[1]);
  firstPet.toggleChat();
  const firstPopup = first.windows[2];
  const firstAPI = first.bridge(firstPopup);
  firstPopup.emit('ready-to-show');
  firstAPI.moveChatWindow({ dx: 120, dy: 200 });
  firstAPI.finishChatMove();
  const saved = { ...firstPopup.bounds };
  first.app.emit('before-quit');

  const second = await setup(files);
  try {
    const petAPI = second.bridge(second.windows[1]);
    petAPI.toggleChat();
    const popup = second.windows[2];
    const popupAPI = second.bridge(popup);
    popup.emit('ready-to-show');
    assert.equal(await popupAPI.getChatFollow(), false);
    assert.deepEqual(popup.bounds, saved);
    petAPI.moveCharacter({ dx: 200, dy: 0 });
    assert.deepEqual(popup.bounds, saved);
  } finally {
    second.app.emit('before-quit');
  }
});
