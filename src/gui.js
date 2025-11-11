'use strict';

const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron');
const { resolve } = require('path');
const { ensureFfmpegAvailable, separateAudio, codecMap } = require('./separate');

let mainWindow;

async function handleSelectFile() {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: '音频文件', extensions: ['wav', 'mp3', 'flac', 'ogg', 'aac', 'm4a'] },
      { name: '所有文件', extensions: ['*'] },
    ],
  });
  if (canceled || !filePaths?.length) {
    return null;
  }
  return filePaths[0];
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    resizable: true,
    title: '人声与伴奏分离工具 - CYBERPUNK EDITION',
    backgroundColor: '#0a0a0f',
    webPreferences: {
      preload: resolve(__dirname, 'preload.js'),
    },
  });

  mainWindow.loadFile(resolve(__dirname, '../public/index.html'));
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  try {
    await ensureFfmpegAvailable();
  } catch (err) {
    dialog.showErrorBox('FFmpeg 检测失败', `${err.message}\n\n请安装 FFmpeg 并确保其在系统 PATH 中可用。`);
    app.quit();
    return;
  }

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

ipcMain.handle('select-file', handleSelectFile);

ipcMain.handle('separate-audio', async (_event, options) => {
  try {
    const result = await separateAudio(options);
    return { success: true, result };
  } catch (err) {
    return { success: false, message: err.message };
  }
});

ipcMain.handle('get-formats', () => Array.from(codecMap.keys()));

ipcMain.handle('open-folder', async (_event, targetPath) => {
  if (!targetPath) {
    return;
  }
  await shell.openPath(targetPath);
});
