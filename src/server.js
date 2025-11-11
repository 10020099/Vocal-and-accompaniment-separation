'use strict';

const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { ensureFfmpegAvailable, separateAudio, codecMap } = require('./separate');

const app = express();
const PORT = process.env.PORT || 3000;

const uploadsDir = path.join(__dirname, '../uploads');
const outputsDir = path.join(__dirname, '../outputs');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

if (!fs.existsSync(outputsDir)) {
  fs.mkdirSync(outputsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedExts = ['.wav', '.mp3', '.flac', '.ogg', '.aac', '.m4a'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('不支持的文件格式'));
    }
  },
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

app.get('/api/formats', (req, res) => {
  const formats = Array.from(codecMap.keys());
  res.json({ success: true, formats });
});

app.post('/api/upload', upload.single('audio'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: '未上传文件' });
  }
  res.json({
    success: true,
    file: {
      filename: req.file.filename,
      originalName: req.file.originalname,
      path: req.file.path,
      size: req.file.size,
    },
  });
});

app.post('/api/separate', async (req, res) => {
  const { filename, format = 'wav' } = req.body;

  if (!filename) {
    return res.status(400).json({ success: false, message: '缺少文件名参数' });
  }

  const inputPath = path.join(uploadsDir, filename);

  if (!fs.existsSync(inputPath)) {
    return res.status(404).json({ success: false, message: '找不到上传的文件' });
  }

  try {
    const result = await separateAudio({
      input: inputPath,
      outDir: outputsDir,
      format,
    });

    const instrumentalFilename = path.basename(result.instrumentalPath);
    const vocalFilename = path.basename(result.vocalPath);

    res.json({
      success: true,
      result: {
        instrumental: `/api/download/${instrumentalFilename}`,
        vocal: `/api/download/${vocalFilename}`,
        instrumentalFilename,
        vocalFilename,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/download/:filename', (req, res) => {
  const { filename } = req.params;
  const filePath = path.join(outputsDir, filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ success: false, message: '文件不存在' });
  }

  const target = codecMap.get(path.extname(filename).slice(1)) || codecMap.get('wav');
  res.setHeader('Content-Type', target.mime);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.sendFile(filePath);
});

async function startServer() {
  try {
    await ensureFfmpegAvailable();
    console.log('✓ FFmpeg 检测成功');
  } catch (err) {
    console.error('✗ FFmpeg 检测失败:', err.message);
    console.error('请安装 FFmpeg 并确保其在系统 PATH 中可用。');
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  人声与伴奏分离工具 - WEB 应用服务器');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');
    console.log(`  ► 服务器地址: http://localhost:${PORT}`);
    console.log('  ► 按 Ctrl+C 停止服务器');
    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
  });
}

startServer();
