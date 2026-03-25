/**
 * Custom Browser Implementation - Built on Electron/Chromium
 * Similar to Opera GX - a real browser using Chromium engine
 */
const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");

class BrowserManager {
    constructor() {
        this.windows = [];
        this.activeWindow = null;
    }

    createBrowserWindow(options = {}) {
        const browserWin = new BrowserWindow({
            width: options.width || 1400,
            height: options.height || 900,
            minWidth: 800,
            minHeight: 600,
            backgroundColor: "#0a0a0a",
            show: false,
            webPreferences: {
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

        // Load the browser UI
        browserWin.loadFile(path.join(__dirname, "browser-ui.html"));

        browserWin.once('ready-to-show', () => {
            browserWin.show();
        });

        browserWin.on('closed', () => {
            const index = this.windows.indexOf(browserWin);
            if (index > -1) {
                this.windows.splice(index, 1);
            }
            if (this.activeWindow === browserWin) {
                this.activeWindow = this.windows[0] || null;
            }
        });

        this.windows.push(browserWin);
        this.activeWindow = browserWin;

        return browserWin;
    }
}

const browser = new BrowserManager();

function createWindow() {
    browser.createBrowserWindow();
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (browser.windows.length === 0) {
        createWindow();
    }
});

// Handle navigation requests from renderer
ipcMain.handle('navigate-to-url', async (event, url) => {
    const webContents = event.sender;
    if (webContents) {
        await webContents.loadURL(url);
    }
});

// Handle new tab creation
ipcMain.handle('create-new-tab', async (event) => {
    const browserWin = BrowserWindow.fromWebContents(event.sender);
    if (browserWin) {
        // Create new tab in same window - this will be handled by the renderer
        return { success: true };
    }
});

// Handle tab closing
ipcMain.handle('close-tab', async (event, tabId) => {
    // Handle tab closing logic
    return { success: true };
});
