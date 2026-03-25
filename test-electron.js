const { app, BrowserWindow } = require('electron');

function createWindow() {
  console.log('Creating window...');
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });
  win.loadFile('browser-ui.html');
}

console.log('App ready?', app);
if (app && app.whenReady) {
  app.whenReady().then(createWindow);
} else {
  console.error('Electron app not properly loaded');
}
