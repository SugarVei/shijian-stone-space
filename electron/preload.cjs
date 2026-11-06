const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('stoneDesktop', {
  drives: () => ipcRenderer.invoke('stone:drives'),
  bootstrap: () => ipcRenderer.invoke('stone:bootstrap'),
  loadScan: (path,requestId,force=false) => ipcRenderer.invoke('stone:load',path,requestId,force),
  scan: (path, requestId) => ipcRenderer.invoke('stone:scan', path, requestId),
  cancel: () => ipcRenderer.invoke('stone:cancel'),
  aiConfig: () => ipcRenderer.invoke('stone:ai-config'),
  saveAIConfig: input => ipcRenderer.invoke('stone:ai-save', input),
  analyzeCleanup: scope => ipcRenderer.invoke('stone:ai-analyze', scope),
  cancelAnalysis: () => ipcRenderer.invoke('stone:ai-cancel'),
  trashCandidates: (reportId, ids) => ipcRenderer.invoke('stone:trash', reportId, ids),
  openFolder: path => ipcRenderer.invoke('stone:open', path),
  windowAction: action => ipcRenderer.invoke('stone:window', action),
  onScan: callback => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('stone:progress', listener);
    return () => ipcRenderer.removeListener('stone:progress', listener);
  }
});
