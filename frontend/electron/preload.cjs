const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('step1', {
  // ========================================
  // 캐릭터 선택 동기화
  // ========================================

  selectCharacter: (characterType) => {
    ipcRenderer.send('character:select', characterType);
  },

  getCharacter: () => {
    return ipcRenderer.invoke('character:get');
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