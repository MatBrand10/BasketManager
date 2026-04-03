const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

const createWindow = () => {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 640,
    backgroundColor: '#0b1020',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.loadFile(path.join(__dirname, '..', 'index.html'));
};

const getStorePath = () => path.join(app.getPath('userData'), 'saves.json');

const readStore = () => {
  try {
    const raw = fs.readFileSync(getStorePath(), 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    return {};
  }
};

const writeStore = (store) => {
  try {
    fs.mkdirSync(path.dirname(getStorePath()), { recursive: true });
    fs.writeFileSync(getStorePath(), JSON.stringify(store));
  } catch (err) {
    // ignore write errors
  }
};

ipcMain.on('storage-get', (event, key) => {
  const store = readStore();
  event.returnValue = store[key] ?? null;
});

ipcMain.on('storage-set', (event, key, value) => {
  const store = readStore();
  store[key] = String(value);
  writeStore(store);
  event.returnValue = true;
});

ipcMain.on('storage-remove', (event, key) => {
  const store = readStore();
  delete store[key];
  writeStore(store);
  event.returnValue = true;
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
