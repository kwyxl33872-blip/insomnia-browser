/**
 * Browser preload script - enables proper browser functionality
 */
const { contextBridge, ipcRenderer } = require('electron');

// Expose browser APIs to renderer
contextBridge.exposeInMainWorld('electronAPI', {
    navigateToUrl: (url) => ipcRenderer.invoke('navigate-to-url', url),
    createNewTab: () => ipcRenderer.invoke('create-new-tab'),
    closeTab: (tabId) => ipcRenderer.invoke('close-tab', tabId)
});
