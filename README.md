# 人声与伴奏分离工具 - Web 应用版

基于 FFmpeg 的人声与伴奏分离工具，现已升级为 Web 应用！使用立体声声道相加/相减算法，快速分离音频中的人声与伴奏。

## ✨ 特性

- 🌐 **纯 Web 应用** - 无需安装 Electron，通过浏览器访问
- 🎨 **赛博朋克风格 UI** - 炫酷的霓虹灯效果和动画
- 📁 **拖拽上传** - 支持拖放文件或点击选择
- 🎵 **多格式支持** - WAV、MP3、FLAC、OGG、AAC、M4A
- ⚡ **快速处理** - 基于 FFmpeg 的高效音频处理
- 💾 **便捷下载** - 处理完成后直接下载结果文件
- 🖥️ **命令行工具** - 同时保留 CLI 功能

## 📋 前置要求

1. **Node.js** - 版本 18 或更高
2. **FFmpeg** - 必须安装并配置到系统 PATH

### 安装 FFmpeg

#### macOS
```bash
brew install ffmpeg
```

#### Ubuntu/Debian
```bash
sudo apt update
sudo apt install ffmpeg
```

#### Windows
从 [FFmpeg 官网](https://ffmpeg.org/download.html) 下载并添加到系统 PATH

验证安装：
```bash
ffmpeg -version
```

## 🚀 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 启动 Web 服务器

```bash
npm start
```

服务器将在 `http://localhost:3000` 启动

### 3. 使用应用

1. 打开浏览器访问 `http://localhost:3000`
2. 拖拽或点击选择音频文件
3. 选择输出格式（默认 WAV）
4. 点击"开始分离"按钮
5. 等待处理完成后下载结果文件

## 🖥️ 命令行使用

除了 Web 界面，您仍然可以使用命令行工具：

```bash
# 使用 npm script
npm run cli -- --input ./song.mp3 --format wav

# 或者全局安装后使用
npm install -g .
vocal-split --input ./song.mp3 --format mp3 --output ./results
```

### CLI 参数

- `--input, -i` - 输入音频文件路径（必需）
- `--format, -f` - 输出格式：wav, mp3, flac, ogg, aac, m4a（默认：wav）
- `--output, -o` - 输出目录（可选，默认为源文件同级的 output 目录）

## 🔧 API 接口

Web 服务提供以下 REST API 接口：

### GET /api/formats
获取支持的输出格式列表

```json
{
  "success": true,
  "formats": ["wav", "flac", "mp3", "ogg", "aac", "m4a"]
}
```

### POST /api/upload
上传音频文件

- Content-Type: `multipart/form-data`
- Body: `audio` 字段包含文件

响应：
```json
{
  "success": true,
  "file": {
    "filename": "1234567890-song.mp3",
    "originalName": "song.mp3",
    "path": "/path/to/uploads/1234567890-song.mp3",
    "size": 5242880
  }
}
```

### POST /api/separate
处理音频分离

- Content-Type: `application/json`
- Body:
```json
{
  "filename": "1234567890-song.mp3",
  "format": "wav"
}
```

响应：
```json
{
  "success": true,
  "result": {
    "instrumental": "/api/download/song_instrumental.wav",
    "vocal": "/api/download/song_vocals.wav",
    "instrumentalFilename": "song_instrumental.wav",
    "vocalFilename": "song_vocals.wav"
  }
}
```

### GET /api/download/:filename
下载处理后的文件

## 📁 项目结构

```
.
├── src/
│   ├── server.js      # Express Web 服务器
│   ├── separate.js    # 核心音频分离逻辑
│   └── index.js       # CLI 命令行工具
├── public/
│   ├── index.html     # Web 应用前端
│   ├── renderer.js    # 前端 JavaScript
│   └── style.css      # 赛博朋克风格样式
├── uploads/           # 上传文件临时目录（自动创建）
├── outputs/           # 处理结果输出目录（自动创建）
└── package.json
```

## ⚙️ 配置

### 修改端口

通过环境变量 `PORT` 设置服务器端口：

```bash
PORT=8080 npm start
```

### 文件大小限制

默认最大上传文件大小为 500MB，可在 `src/server.js` 中修改：

```javascript
const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 修改此处
  // ...
});
```

## 🎯 工作原理

本工具使用 FFmpeg 的立体声声道操作来分离人声和伴奏：

- **伴奏（Instrumental）**: 通过左右声道相减实现
  - 滤镜：`pan=stereo|c0=c0-c1|c1=c1-c0`
  - 原理：消除居中的人声，保留左右分离的伴奏

- **人声（Vocals）**: 通过左右声道相加实现
  - 滤镜：`pan=stereo|c0=c0+c1|c1=c0+c1`
  - 原理：增强居中的人声信号

> ⚠️ **注意**：此方法适用于大部分流行音乐制作，但效果取决于原始音轨的混音方式。对于人声不在中央声道的音乐，分离效果可能不理想。

## 🛠️ 开发

### 开发模式

```bash
# 启动服务器（自动监听文件变化需要 nodemon）
npm install -g nodemon
nodemon src/server.js
```

### 测试 API

```bash
# 获取格式列表
curl http://localhost:3000/api/formats

# 上传文件
curl -X POST -F "audio=@test.mp3" http://localhost:3000/api/upload

# 处理分离
curl -X POST -H "Content-Type: application/json" \
  -d '{"filename":"1234567890-test.mp3","format":"wav"}' \
  http://localhost:3000/api/separate
```

## 📝 更新日志

### v1.0.0 - Web 应用版
- ✅ 移除 Electron 依赖
- ✅ 创建 Express Web 服务器
- ✅ 实现 REST API 接口
- ✅ 添加拖拽上传功能
- ✅ 改进 UI/UX 体验
- ✅ 保留命令行工具功能
- ✅ 优化安装速度和体积

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License

## 🙏 致谢

- [FFmpeg](https://ffmpeg.org/) - 强大的多媒体处理工具
- [Express.js](https://expressjs.com/) - Web 应用框架
- [Multer](https://github.com/expressjs/multer) - 文件上传中间件
