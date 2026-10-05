const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('buddy', {
  getSetup: () => ipcRenderer.invoke('get-setup'),
  setInteractive: (value) => ipcRenderer.send('set-interactive', value),
  answer: (choice) => ipcRenderer.send('answer', choice),
  state: (value) => ipcRenderer.send('renderer-state', value),
  onAsk: (callback) => ipcRenderer.on('ask', (_event, payload) => callback(payload)),
  onSuppress: (callback) => ipcRenderer.on('suppress', () => callback())
});
