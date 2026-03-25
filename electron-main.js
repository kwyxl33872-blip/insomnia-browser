/**
 * Electron main process: Real Browser Implementation
 * Built on Chromium like Opera GX
 */
const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");

function createWindow() {
    const win = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 800,
        minHeight: 600,
        backgroundColor: "#0a0a0a",
        webPreferences: {
            preload: path.join(__dirname, "electron-preload.js"),
            contextIsolation: false,
            nodeIntegration: true,
            webSecurity: false,
            allowRunningInsecureContent: true,
            experimentalFeatures: true,
            webviewTag: true,
            plugins: true,
            sandbox: false
        },
    });

    win.loadFile(path.join(__dirname, "main.html"));
    
    // Handle IPC for DevTools toggle from renderer
    ipcMain.handle('toggle-devtools', () => {
        win.webContents.toggleDevTools();
    });
}

app.whenReady().then(createWindow);

app.on("window-all-closed", function () {
    if (process.platform !== "darwin") {
        app.quit();
    }
});

app.on("activate", function () {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
