// Since contextIsolation is false, we can expose directly to window
const { ipcRenderer } = require('electron');

window.electronShell = {
    isElectron: true,
    electronVersion: process.versions.electron,
    chromeVersion: process.versions.chrome,
    toggleDevTools: () => ipcRenderer.invoke('toggle-devtools')
};
