'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  selectFile: () => ipcRenderer.invoke('select-file'),
  separateAudio: (payload) => ipcRenderer.invoke('separate-audio', payload),
  getFormats: () => ipcRenderer.invoke('get-formats'),
  openFolder: (targetPath) => ipcRenderer.invoke('open-folder', targetPath),
});
