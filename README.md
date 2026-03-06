# 人声与伴奏分离工具

基于 FFmpeg 的人声与伴奏分离工具，使用 Rust 构建。通过立体声声道相加/相减算法，快速分离音频中的人声与伴奏。支持 Web 界面和命令行两种使用方式。

## 特性

- **高性能 Rust 后端** - 低内存占用，快速启动，单二进制分发
- **纯 Web 应用** - 通过浏览器访问，拖拽上传
- **Docker 支持** - 一条命令部署，无需安装任何依赖
- **多格式支持** - WAV、MP3、FLAC、OGG、AAC、M4A
- **命令行工具** - 同时保留 CLI 功能

## 快速开始（Docker）

最简单的方式是使用 Docker，无需安装 Rust 或 FFmpeg：

```bash
docker pull ghcr.io/10020099/vocal-and-accompaniment-separation:latest
docker run -p 3000:3000 ghcr.io/10020099/vocal-and-accompaniment-separation:latest
```

打开浏览器访问 `http://localhost:3000` 即可使用。

如需持久化输出文件：

```bash
docker run -p 3000:3000 \
  -v ./uploads:/app/uploads \
  -v ./outputs:/app/outputs \
  ghcr.io/10020099/vocal-and-accompaniment-separation:latest
```

## 从源码构建

### 前置要求

1. **Rust** - 安装 [rustup](https://rustup.rs/)
2. **FFmpeg** - 必须安装并配置到系统 PATH

### 安装 FFmpeg

**macOS:**
```bash
brew install ffmpeg
```

**Ubuntu/Debian:**
```bash
sudo apt update && sudo apt install ffmpeg
```

**Windows:**
从 [FFmpeg 官网](https://ffmpeg.org/download.html) 下载并添加到系统 PATH

### 编译运行

```bash
cargo build --release
./target/release/vocal-split
```

服务器将在 `http://localhost:3000` 启动。

## 命令行使用

```bash
# 启动 Web 服务器（默认端口 3000）
vocal-split
vocal-split serve --port 8080

# 分离音频文件
vocal-split split ./song.mp3
vocal-split split ./song.mp3 --out ./results --format flac
```

### CLI 参数

**`vocal-split serve`** - 启动 Web 服务器
- `--port, -p` - 端口号（默认：3000，也可通过 `PORT` 环境变量设置）

**`vocal-split split <文件路径>`** - 分离音频
- `--out, -o` - 输出目录（默认：`./output`）
- `--format, -f` - 输出格式：wav, mp3, flac, ogg, aac, m4a（默认：wav）

## API 接口

### GET /api/formats
获取支持的输出格式列表

### POST /api/upload
上传音频文件（`multipart/form-data`，字段名 `audio`）

### POST /api/separate
处理音频分离（`application/json`）
```json
{ "filename": "上传后的文件名", "format": "wav" }
```

### GET /api/download/{filename}
下载处理后的文件

## 项目结构

```
├── Cargo.toml
├── Dockerfile
├── .github/workflows/docker.yml   # CI/CD 自动构建镜像
├── src/
│   ├── main.rs          # 入口：子命令分发
│   ├── separate.rs      # 核心音频分离逻辑
│   ├── server.rs        # Axum Web 服务器
│   └── cli.rs           # CLI 模式
├── public/
│   ├── index.html       # Web 前端
│   ├── renderer.js      # 前端交互
│   └── style.css        # 样式
├── uploads/             # 上传文件临时目录（运行时创建）
└── outputs/             # 处理结果目录（运行时创建）
```

## 工作原理

本工具使用 FFmpeg 的立体声声道操作来分离人声和伴奏：

- **伴奏**：左右声道相减（`c0-c1`），消除居中的人声，保留左右分离的伴奏
- **人声**：左右声道相加（`0.5*c0+0.5*c1`），增强居中的人声信号

> **注意**：此方法适用于人声位于中央声道的标准混音。对于非标准混音方式的音乐，分离效果可能不理想。

## 技术栈

- **后端**：Rust + Axum + Tokio
- **前端**：原生 HTML/CSS/JS
- **音频处理**：FFmpeg
- **CI/CD**：GitHub Actions + ghcr.io

## 许可证

MIT License
