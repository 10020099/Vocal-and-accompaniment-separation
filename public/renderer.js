'use strict';

const selectFileBtn = document.getElementById('select-file');
const fileNameEl = document.getElementById('file-name');
const formatSelect = document.getElementById('format');
const outDirInput = document.getElementById('out-dir');
const startBtn = document.getElementById('start');
const logPanel = document.getElementById('log-panel');
const logArea = document.getElementById('log');
const resultBlock = document.getElementById('result');
const resultPathEl = document.getElementById('result-path');
const openFolderBtn = document.getElementById('open-folder');

let currentFile = null;
let lastOutDir = null;

function appendLog(message, type = 'info') {
  const timestamp = new Date().toLocaleTimeString();
  const prefix = type === 'success' ? '✓' : type === 'error' ? '✗' : '▸';
  const text = `${prefix} [${timestamp}] ${message}`;
  logArea.textContent += text + '\n';
  logArea.scrollTop = logArea.scrollHeight;
}

async function initFormats() {
  const formats = await window.api.getFormats();
  formatSelect.innerHTML = '';
  formats.forEach((item) => {
    const option = document.createElement('option');
    option.value = item;
    option.textContent = item.toUpperCase();
    formatSelect.appendChild(option);
  });
}

selectFileBtn.addEventListener('click', async () => {
  const filePath = await window.api.selectFile();
  if (!filePath) {
    return;
  }
  currentFile = filePath;
  fileNameEl.textContent = filePath;
  fileNameEl.classList.remove('muted');
  startBtn.disabled = false;
  logPanel.hidden = false;
  logArea.textContent = '';
  resultBlock.hidden = true;
  appendLog(`已选择文件: ${filePath}`, 'info');
});

startBtn.addEventListener('click', async () => {
  if (!currentFile) {
    appendLog('请先选择文件', 'error');
    return;
  }

  startBtn.disabled = true;
  appendLog('═══════════════════════════════════════════', 'info');
  appendLog('>>> 初始化分离进程...', 'info');
  appendLog('═══════════════════════════════════════════', 'info');

  const format = formatSelect.value || 'wav';
  const outDir = outDirInput.value.trim() || undefined;

  try {
    const response = await window.api.separateAudio({
      input: currentFile,
      outDir,
      format,
    });

    if (!response?.success) {
      throw new Error(response?.message || '未知错误');
    }

    const { instrumentalPath, vocalPath, outDir: resultDir } = response.result;
    lastOutDir = resultDir;

    appendLog('───────────────────────────────────────────', 'info');
    appendLog('伴奏已输出: ' + instrumentalPath, 'success');
    appendLog('人声已输出: ' + vocalPath, 'success');
    appendLog('───────────────────────────────────────────', 'info');

    resultPathEl.textContent = resultDir;
    resultBlock.hidden = false;
    appendLog('▓▓▓▓▓▓▓▓▓▓ 处理完成 ▓▓▓▓▓▓▓▓▓▓', 'success');
  } catch (err) {
    appendLog('>>> 处理失败: ' + err.message, 'error');
  } finally {
    startBtn.disabled = false;
  }
});

openFolderBtn.addEventListener('click', () => {
  if (!lastOutDir) {
    appendLog('当前没有可打开的目录', 'error');
    return;
  }
  window.api.openFolder(lastOutDir);
  appendLog('>>> 正在打开输出目录...', 'info');
});

initFormats();
