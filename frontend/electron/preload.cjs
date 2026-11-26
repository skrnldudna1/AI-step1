const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('step1', {

  // ========================================
  // 채팅창 제어
  // ========================================

  toggleChat: () => {
    ipcRenderer.send('chat:toggle');
  },
  openChat: () => ipcRenderer.send('chat:open'),
  hideChat: () => ipcRenderer.send('chat:hide'),
  openSettings: () => ipcRenderer.send('settings:open'),
  getPersonaState: () => ipcRenderer.invoke('persona:get'),
  setCharacterProfile: (type, profile) => ipcRenderer.invoke('persona:set', type, profile),
  onPersonaChanged: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('persona:changed', listener);
    return () => ipcRenderer.removeListener('persona:changed', listener);
  },
  getChatFollow: () => ipcRenderer.invoke('chat:follow-get'),
  getChatOpacity: () => ipcRenderer.invoke('chat:opacity-get'),
  setChatOpacity: opacity => ipcRenderer.send('chat:opacity-set', opacity),
  onChatOpacityChanged: callback => {
    const listener = (_event, opacity) => callback(opacity);
    ipcRenderer.on('chat:opacity-changed', listener);
    return () => ipcRenderer.removeListener('chat:opacity-changed', listener);
  },
  setChatFollow: (follow) => ipcRenderer.send('chat:follow-set', follow),
  onChatFollowChanged: (callback) => {
    const listener = (_event, follow) => callback(follow);
    ipcRenderer.on('chat:follow-changed', listener);
    return () => ipcRenderer.removeListener('chat:follow-changed', listener);
  },
  moveChatWindow: (position) => ipcRenderer.send('chat:move', position),
  finishChatMove: () => ipcRenderer.send('chat:move-end'),
  startChatResize: (edge, id) => ipcRenderer.send('chat:resize-start', edge, id),
  resizeChatWindow: (payload) => ipcRenderer.send('chat:resize-update', payload),
  finishChatResize: id => ipcRenderer.send('chat:resize-end', id),
  getChatState: () => ipcRenderer.invoke('chat:state-get'),
  submitChatMessage: (message) => ipcRenderer.invoke('chat:submit', message),
  clearChat: () => ipcRenderer.invoke('chat:clear'),
  getAIConnection: () => ipcRenderer.invoke('ai:connection-get'),
  signInChatGPT: id => ipcRenderer.invoke('ai:signin', id),
  cancelAIConnection: () => ipcRenderer.invoke('ai:cancel'),
  selectChatGPTAccount: id => ipcRenderer.invoke('ai:select-account', id),
  useBackendAI: () => ipcRenderer.invoke('ai:backend'),
  signOutChatGPT: () => ipcRenderer.invoke('ai:signout'),
  selectChatGPTModel: id => ipcRenderer.invoke('ai:select-model', id),
  refreshChatGPTModels: () => ipcRenderer.invoke('ai:refresh-models'),
  dismissChatGPTWelcome: () => ipcRenderer.invoke('ai:welcome-dismiss'),
  openChatGPTUsage: () => ipcRenderer.send('ai:usage'),
  analyzeRigImages: images => ipcRenderer.invoke('rig:vision-analyze', images),
  onAIConnectionChanged: callback => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('ai:connection-changed', listener);
    return () => ipcRenderer.removeListener('ai:connection-changed', listener);
  },
  onChatStateChanged: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('chat:state-changed', listener);
    return () => ipcRenderer.removeListener('chat:state-changed', listener);
  },

  // ========================================
  // 캐릭터 위치 이동
  // ========================================

  moveCharacter: (position) => {
    ipcRenderer.send('character:move', position);
  },

  // 캐릭터의 투명 영역은 클릭 통과
  setCharacterMouseIgnored: (ignore) => {
    ipcRenderer.send('character:mouse-ignore', ignore);
  },
  onCharacterCursor: (callback) => {
    const listener = (_event, point) => callback(point);
    ipcRenderer.on('character:cursor', listener);
    return () => ipcRenderer.removeListener('character:cursor', listener);
  },

  // 캐릭터 크기 동기화
  setCharacterSize: (size) => {
    ipcRenderer.send('character:size-set', size);
  },
  getCharacterSize: () => {
    return ipcRenderer.invoke('character:size-get');
  },
  onCharacterSizeChanged: (callback) => {
    const listener = (_event, size) => callback(size);
    ipcRenderer.on('character:size-changed', listener);
    return () => {
      ipcRenderer.removeListener('character:size-changed', listener);
    };
  },

  // ========================================
  // 캐릭터 선택 동기화
  // ========================================

  selectCharacter: (characterType) => {
    ipcRenderer.send('character:select', characterType);
  },

  getCharacter: () => {
    return ipcRenderer.invoke('character:get');
  },

    // 커스텀 캐릭터 리깅 데이터 전송
  sendCustomRig: (rig) => {
    ipcRenderer.send('character:custom-rig', rig);
  },

  // 저장된 커스텀 리깅 데이터 요청
  getCustomRig: () => {
    return ipcRenderer.invoke('character:custom-rig-get');
  },

  // 커스텀 리깅 데이터 변경 감지
  onCustomRigChanged: (callback) => {
    const listener = (_event, rig) => {
      callback(rig);
    };

    ipcRenderer.on('character:custom-rig-changed', listener);

    return () => {
      ipcRenderer.removeListener(
        'character:custom-rig-changed',
        listener
      );
    };
  },

  onCharacterChanged: (callback) => {
    const listener = (_event, characterType) => {
      callback(characterType);
    };

    ipcRenderer.on('character:changed', listener);

    return () => {
      ipcRenderer.removeListener(
        'character:changed',
        listener
      );
    };
  },

  // ========================================
  // AI 감정 및 애니메이션 동기화
  // ========================================

  getReactionState: () => ipcRenderer.invoke('character:reaction-get'),
  updateReaction: (patch) => ipcRenderer.send('character:reaction-update', patch),

  onReactionChanged: (callback) => {
    const listener = (_event, reactionState) => {
      callback(reactionState);
    };

    ipcRenderer.on('character:reaction-changed', listener);

    return () => {
      ipcRenderer.removeListener(
        'character:reaction-changed',
        listener
      );
    };
  },
});
