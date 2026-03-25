<<<<<<< HEAD
// Since contextIsolation is false, we can expose directly to window
const { ipcRenderer } = require('electron');

window.electronShell = {
    isElectron: true,
    electronVersion: process.versions.electron,
    chromeVersion: process.versions.chrome,
    toggleDevTools: () => ipcRenderer.invoke('toggle-devtools')
};
=======
// Since contextIsolation is false, we can expose directly to window
const { ipcRenderer } = require('electron');

window.electronShell = {
    isElectron: true,
    electronVersion: process.versions.electron,
    chromeVersion: process.versions.chrome,
    toggleDevTools: () => ipcRenderer.invoke('toggle-devtools')
};
>>>>>>> ea626d7be2661ff009d4f1e7032eb2b0d1170146
