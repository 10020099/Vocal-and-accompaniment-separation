'use strict';

// ===== DOM Elements =====
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const selectFileBtn = document.getElementById('select-file');
const fileInfo = document.getElementById('file-info');
const fileNameEl = document.getElementById('file-name');
const fileSizeEl = document.getElementById('file-size');
const removeFileBtn = document.getElementById('remove-file');
const formatSelect = document.getElementById('format');
const startBtn = document.getElementById('start');

// Progress Section
const progressSection = document.getElementById('progress-section');
const progressFill = document.getElementById('progress-fill');
const progressStatus = document.getElementById('progress-status');
const logArea = document.getElementById('log');

// Result Section
const resultSection = document.getElementById('result-section');
const downloadInstrumentalBtn = document.getElementById('download-instrumental');
const downloadVocalBtn = document.getElementById('download-vocal');
const vocalFilenameEl = document.getElementById('vocal-filename');
const instrumentalFilenameEl = document.getElementById('instrumental-filename');
const processAnotherBtn = document.getElementById('process-another');

// ===== State =====
let currentFile = null;
let uploadedFilename = null;
let isProcessing = false;

// ===== Utility Functions =====
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

function updateProgress(percent, status) {
  progressFill.style.width = `${percent}%`;
  if (status) {
    progressStatus.textContent = status;
  }
}

function resetUI() {
  currentFile = null;
  uploadedFilename = null;
  isProcessing = false;
  fileInput.value = '';
  fileInfo.hidden = true;
  dropZone.classList.remove('has-file');
  progressSection.hidden = true;
  resultSection.hidden = true;
  startBtn.disabled = true;
  logArea.textContent = '';
  updateProgress(0, '');
}

// ===== Smooth Scroll =====
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    e.preventDefault();
    const target = document.querySelector(this.getAttribute('href'));
    if (target) {
      target.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }
  });
});

// ===== Initialize Formats =====
async function initFormats() {
  try {
    const response = await fetch('/api/formats');
    const data = await response.json();
    if (data.success) {
      formatSelect.innerHTML = '';
      data.formats.forEach((format) => {
        const option = document.createElement('option');
        option.value = format;
        option.textContent = format.toUpperCase();
        if (format === 'wav') {
          option.selected = true;
        }
        formatSelect.appendChild(option);
      });
    }
  } catch (err) {
    console.error('Failed to load formats:', err);
    // Set default formats as fallback
    const defaultFormats = ['wav', 'mp3', 'flac', 'ogg', 'aac', 'm4a'];
    formatSelect.innerHTML = '';
    defaultFormats.forEach((format) => {
      const option = document.createElement('option');
      option.value = format;
      option.textContent = format.toUpperCase();
      if (format === 'wav') {
        option.selected = true;
      }
      formatSelect.appendChild(option);
    });
  }
}

// ===== File Handling =====
function handleFileSelect(file) {
  if (!file) return;

  // Check if it's an audio file
  const validTypes = ['audio/', '.wav', '.mp3', '.flac', '.ogg', '.aac', '.m4a'];
  const isValid = validTypes.some(type => 
    file.type.startsWith('audio/') || file.name.toLowerCase().endsWith(type)
  );

  if (!isValid) {
    alert('请选择一个音频文件 (WAV, MP3, FLAC, OGG, AAC, M4A)');
    return;
  }

  currentFile = file;
  fileNameEl.textContent = file.name;
  fileSizeEl.textContent = formatFileSize(file.size);
  fileInfo.hidden = false;
  dropZone.classList.add('has-file');
  startBtn.disabled = false;
  
  // Hide result section when new file is selected
  resultSection.hidden = true;
  progressSection.hidden = true;
}

// ===== Event Listeners =====

// File Selection
selectFileBtn.addEventListener('click', () => {
  fileInput.click();
});

fileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  handleFileSelect(file);
});

// Remove File
if (removeFileBtn) {
  removeFileBtn.addEventListener('click', () => {
    resetUI();
  });
}

// Drag and Drop
dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  if (!dropZone.classList.contains('has-file')) {
    dropZone.classList.add('drag-over');
  }
});

dropZone.addEventListener('dragleave', (e) => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
});

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  
  const file = e.dataTransfer.files[0];
  if (file && !isProcessing) {
    fileInput.files = e.dataTransfer.files;
    handleFileSelect(file);
  }
});

// Click on drop zone to select file
dropZone.addEventListener('click', (e) => {
  if (!dropZone.classList.contains('has-file') && e.target === dropZone) {
    fileInput.click();
  }
});

// ===== Upload and Processing =====
async function uploadFile(file) {
  const formData = new FormData();
  formData.append('audio', file);

  updateProgress(20, '正在上传文件...');
  
  const response = await fetch('/api/upload', {
    method: 'POST',
    body: formData,
  });

  const data = await response.json();
  if (!data.success) {
    throw new Error(data.message || '上传失败');
  }

  updateProgress(40, '文件上传成功');
  return data.file.filename;
}

async function separateAudio(filename, format) {
  updateProgress(50, '正在初始化音频分离...');
  
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

// Start Processing
startBtn.addEventListener('click', async () => {
  if (!currentFile || isProcessing) {
    return;
  }

  isProcessing = true;
  startBtn.disabled = true;
  
  // Show progress section and scroll to it
  progressSection.hidden = false;
  resultSection.hidden = true;
  progressSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
  
  // Reset log
  logArea.textContent = '';
  updateProgress(0, '准备开始处理...');
  
  appendLog('开始处理音频文件', 'info');
  appendLog(`文件名: ${currentFile.name}`, 'info');
  appendLog(`文件大小: ${formatFileSize(currentFile.size)}`, 'info');
  appendLog('═══════════════════════════════════════════', 'info');
  
  const format = formatSelect.value || 'wav';
  appendLog(`输出格式: ${format.toUpperCase()}`, 'info');

  try {
    // Upload file
    appendLog('>>> 正在上传文件...', 'info');
    uploadedFilename = await uploadFile(currentFile);
    appendLog('>>> 文件上传成功', 'success');
    
    // Process separation
    appendLog('>>> 开始音频分离处理...', 'info');
    appendLog('>>> 正在分析音频频谱...', 'info');
    updateProgress(60, '正在处理音频分离...');
    
    const result = await separateAudio(uploadedFilename, format);
    
    updateProgress(80, '正在生成输出文件...');
    appendLog('>>> 正在生成伴奏文件...', 'info');
    await new Promise(resolve => setTimeout(resolve, 500)); // Simulate processing
    appendLog('>>> 伴奏文件生成成功', 'success');
    
    appendLog('>>> 正在生成人声文件...', 'info');
    await new Promise(resolve => setTimeout(resolve, 500)); // Simulate processing
    appendLog('>>> 人声文件生成成功', 'success');
    
    updateProgress(100, '处理完成！');
    appendLog('═══════════════════════════════════════════', 'info');
    appendLog('✓ 音频分离处理完成！', 'success');

    // Update download links
    downloadInstrumentalBtn.href = result.instrumental;
    downloadInstrumentalBtn.download = result.instrumentalFilename;
    instrumentalFilenameEl.textContent = result.instrumentalFilename;
    
    downloadVocalBtn.href = result.vocal;
    downloadVocalBtn.download = result.vocalFilename;
    vocalFilenameEl.textContent = result.vocalFilename;

    // Show result section after a short delay
    setTimeout(() => {
      resultSection.hidden = false;
      resultSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 1000);
    
  } catch (err) {
    updateProgress(0, '处理失败');
    appendLog('>>> 处理失败: ' + err.message, 'error');
    alert('处理失败: ' + err.message);
  } finally {
    isProcessing = false;
    startBtn.disabled = false;
  }
});

// Process Another File
if (processAnotherBtn) {
  processAnotherBtn.addEventListener('click', () => {
    resetUI();
    // Scroll to upload section
    document.querySelector('.upload-section').scrollIntoView({ 
      behavior: 'smooth', 
      block: 'center' 
    });
  });
}

// ===== Navbar Scroll Effect =====
const navbar = document.querySelector('.navbar');
let lastScroll = 0;

window.addEventListener('scroll', () => {
  const currentScroll = window.pageYOffset;
  
  if (currentScroll > 100) {
    navbar.style.background = 'rgba(255, 255, 255, 0.98)';
    navbar.style.boxShadow = '0 2px 10px rgba(0,0,0,0.1)';
  } else {
    navbar.style.background = 'rgba(255, 255, 255, 0.95)';
    navbar.style.boxShadow = 'none';
  }
  
  lastScroll = currentScroll;
});

// ===== Animations on Scroll =====
const observerOptions = {
  threshold: 0.1,
  rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.style.opacity = '1';
      entry.target.style.transform = 'translateY(0)';
    }
  });
}, observerOptions);

// Observe feature cards
document.querySelectorAll('.feature-card').forEach(card => {
  card.style.opacity = '0';
  card.style.transform = 'translateY(20px)';
  card.style.transition = 'opacity 0.6s ease-out, transform 0.6s ease-out';
  observer.observe(card);
});

// ===== Initialize =====
document.addEventListener('DOMContentLoaded', () => {
  initFormats();
  
  // Add loading animation
  const heroTitle = document.querySelector('.hero-title');
  if (heroTitle) {
    heroTitle.style.opacity = '0';
    heroTitle.style.transform = 'translateY(-20px)';
    setTimeout(() => {
      heroTitle.style.transition = 'opacity 1s ease-out, transform 1s ease-out';
      heroTitle.style.opacity = '1';
      heroTitle.style.transform = 'translateY(0)';
    }, 100);
  }
  
  // Add stagger animation to feature tags
  const featureTags = document.querySelectorAll('.feature-tag');
  featureTags.forEach((tag, index) => {
    tag.style.opacity = '0';
    tag.style.transform = 'translateY(10px)';
    setTimeout(() => {
      tag.style.transition = 'opacity 0.5s ease-out, transform 0.5s ease-out';
      tag.style.opacity = '1';
      tag.style.transform = 'translateY(0)';
    }, 200 + (index * 100));
  });
});

// ===== Keyboard Shortcuts =====
document.addEventListener('keydown', (e) => {
  // Ctrl/Cmd + O to open file dialog
  if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
    e.preventDefault();
    if (!isProcessing) {
      fileInput.click();
    }
  }
  
  // Enter to start processing when file is selected
  if (e.key === 'Enter' && currentFile && !isProcessing && !startBtn.disabled) {
    startBtn.click();
  }
  
  // Escape to reset
  if (e.key === 'Escape' && !isProcessing) {
    resetUI();
  }
});

// ===== Performance Monitoring =====
let processingStartTime = null;

// Override start button click to track time
const originalStartClick = startBtn.onclick;
startBtn.addEventListener('click', () => {
  processingStartTime = Date.now();
});

// Add time tracking to result display
const showResultWithTime = () => {
  if (processingStartTime) {
    const processingTime = (Date.now() - processingStartTime) / 1000;
    appendLog(`处理用时: ${processingTime.toFixed(2)} 秒`, 'info');
    processingStartTime = null;
  }
};

// ===== Error Handling =====
window.addEventListener('unhandledrejection', event => {
  console.error('Unhandled promise rejection:', event.reason);
  if (isProcessing) {
    appendLog('发生未知错误，请刷新页面重试', 'error');
    isProcessing = false;
    startBtn.disabled = false;
  }
});

// ===== Page Visibility =====
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && isProcessing) {
    // Page became visible while processing
    appendLog('页面已恢复活动状态', 'info');
  }
});

// ===== Console Welcome Message =====
console.log('%c🎵 VocalSplit - AI音频分离工具 🎵', 'font-size: 20px; color: #6366f1; font-weight: bold;');
console.log('%c欢迎使用 VocalSplit！如有问题请访问 GitHub 仓库获取帮助。', 'color: #666;');