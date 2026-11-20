const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('step1', {

  // ========================================
  // 채팅창 제어
  // ========================================

  toggleChat: () => {
    ipcRenderer.send('chat:toggle');
  },

  // ========================================
  // 캐릭터 위치 이동
  // ========================================

  moveCharacter: (position) => {
    ipcRenderer.send('character:move', position);
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

  sendReaction: (reactionState) => {
    ipcRenderer.send('character:reaction', reactionState);
  },

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