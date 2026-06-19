const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getDevices: () => ipcRenderer.invoke('get-devices'),
  startStream: (data) => ipcRenderer.send('start-stream', data),
  stopStream: () => ipcRenderer.send('stop-stream'),
  updateEmbedPosition: (data) => ipcRenderer.send('update-embed-position', data),
  key: (data) => ipcRenderer.send('key', data),
  text: (data) => ipcRenderer.send('text', data),
  onLog: (callback) => {
    ipcRenderer.removeAllListeners('log');
    ipcRenderer.on('log', (event, message) => callback(message));
  }
});
