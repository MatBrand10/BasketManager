const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronStorage', {
  getItem: (key) => ipcRenderer.sendSync('storage-get', key),
  setItem: (key, value) => ipcRenderer.sendSync('storage-set', key, value),
  removeItem: (key) => ipcRenderer.sendSync('storage-remove', key)
});
