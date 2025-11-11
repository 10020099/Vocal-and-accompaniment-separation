'use strict';

const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const selectFileBtn = document.getElementById('select-file');
const fileInfo = document.getElementById('file-info');
const fileNameEl = document.getElementById('file-name');
const fileSizeEl = document.getElementById('file-size');
const formatSelect = document.getElementById('format');
const startBtn = document.getElementById('start');
const logPanel = document.getElementById('log-panel');
const logArea = document.getElementById('log');
const resultBlock = document.getElementById('result');
const downloadInstrumentalBtn = document.getElementById('download-instrumental');
const downloadVocalBtn = document.getElementById('download-vocal');

let currentFile = null;
let uploadedFilename = null;

function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

function appendLog(message, type = 'info') {
  const timestamp = new Date().toLocaleTimeString();
  const prefix = type === 'success' ? '✓' : type === 'error' ? '✗' : '▸';
  const text = `${prefix} [${timestamp}] ${message}`;
  logArea.textContent += text + '\n';
  logArea.scrollTop = logArea.scrollHeight;
}

async function initFormats() {
  try {
    const response = await fetch('/api/formats');
    const data = await response.json();
    if (data.success) {
      formatSelect.innerHTML = '';
      data.formats.forEach((item) => {
        const option = document.createElement('option');
        option.value = item;
        option.textContent = item.toUpperCase();
        formatSelect.appendChild(option);
      });
    }
  } catch (err) {
    console.error('Failed to load formats:', err);
  }
}

function handleFileSelect(file) {
  if (!file) return;

  currentFile = file;
  fileNameEl.textContent = file.name;
  fileSizeEl.textContent = formatFileSize(file.size);
  fileInfo.hidden = false;
  dropZone.classList.add('has-file');
  startBtn.disabled = false;
  logPanel.hidden = false;
  logArea.textContent = '';
  resultBlock.hidden = true;
  appendLog(`已选择文件: ${file.name} (${formatFileSize(file.size)})`, 'info');
}

selectFileBtn.addEventListener('click', () => {
  fileInput.click();
});

fileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  handleFileSelect(file);
});

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', (e) => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
});

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) {
    fileInput.files = e.dataTransfer.files;
    handleFileSelect(file);
  }
});

async function uploadFile(file) {
  const formData = new FormData();
  formData.append('audio', file);

  const response = await fetch('/api/upload', {
    method: 'POST',
    body: formData,
  });

  const data = await response.json();
  if (!data.success) {
    throw new Error(data.message || '上传失败');
  }

  return data.file.filename;
}

async function separateAudio(filename, format) {
  const response = await fetch('/api/separate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ filename, format }),
  });

  const data = await response.json();
  if (!data.success) {
    throw new Error(data.message || '处理失败');
  }

  return data.result;
}

startBtn.addEventListener('click', async () => {
  if (!currentFile) {
    appendLog('请先选择文件', 'error');
    return;
  }

  startBtn.disabled = true;
  appendLog('═══════════════════════════════════════════', 'info');
  appendLog('>>> 上传文件中...', 'info');

  const format = formatSelect.value || 'wav';

  try {
    uploadedFilename = await uploadFile(currentFile);
    appendLog('>>> 文件上传成功', 'success');
    appendLog('>>> 初始化分离进程...', 'info');
    appendLog('═══════════════════════════════════════════', 'info');

    const result = await separateAudio(uploadedFilename, format);

    appendLog('───────────────────────────────────────────', 'info');
    appendLog('伴奏已生成: ' + result.instrumentalFilename, 'success');
    appendLog('人声已生成: ' + result.vocalFilename, 'success');
    appendLog('───────────────────────────────────────────', 'info');

    downloadInstrumentalBtn.href = result.instrumental;
    downloadInstrumentalBtn.download = result.instrumentalFilename;
    downloadVocalBtn.href = result.vocal;
    downloadVocalBtn.download = result.vocalFilename;

    resultBlock.hidden = false;
    appendLog('▓▓▓▓▓▓▓▓▓▓ 处理完成 ▓▓▓▓▓▓▓▓▓▓', 'success');
  } catch (err) {
    appendLog('>>> 处理失败: ' + err.message, 'error');
  } finally {
    startBtn.disabled = false;
  }
});

initFormats();
