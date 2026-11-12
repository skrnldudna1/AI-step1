const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('step1', {
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
});