# 从 Electron 迁移到 Web 应用

## 主要变更

本项目已从 Electron 桌面应用成功迁移为纯 Web 应用。以下是主要变更内容：

### 已删除文件

- `src/gui.js` - Electron 主进程（已删除）
- `src/preload.js` - Electron IPC 桥接（已删除）

### 新增文件

- `src/server.js` - Express Web 服务器
- `README.md` - 完整的使用文档
- `MIGRATION.md` - 本迁移指南

### 修改文件

#### package.json
```diff
- "main": "src/gui.js",
+ "main": "src/server.js",
  "scripts": {
-   "start": "node ./src/index.js",
+   "start": "node ./src/server.js",
-   "gui": "electron ./src/gui.js"
+   "cli": "node ./src/index.js"
  },
  "dependencies": {
-   "electron": "^31.0.0"
+   "express": "^4.18.2",
+   "multer": "^1.4.5-lts.1",
+   "cors": "^2.8.5"
  }
```

#### public/index.html
- 添加拖拽上传区域
- 添加文件输入元素
- 替换"打开文件夹"按钮为下载链接

#### public/renderer.js
- 完全重写，使用 fetch API 替代 Electron IPC
- 添加拖拽上传逻辑
- 添加文件上传和处理流程
- 添加下载链接处理

#### public/style.css
- 添加拖拽区域样式
- 添加文件信息显示样式
- 添加下载按钮样式

## 使用变更

### 之前（Electron 版本）

```bash
# 启动 GUI
npm run gui
```

用户需要：
1. 等待 Electron 窗口启动
2. 点击选择文件
3. 配置输出选项
4. 点击处理
5. 点击打开输出目录

### 现在（Web 版本）

```bash
# 启动 Web 服务器
npm start
```

用户需要：
1. 在浏览器访问 http://localhost:3000
2. 拖拽文件或点击选择
3. 配置输出选项
4. 点击处理
5. 直接下载结果文件

## 优势

### 安装更快
- ❌ 之前：需要下载 ~200MB 的 Electron 二进制文件
- ✅ 现在：只需安装轻量级的 npm 包（~5MB）

### 更易部署
- ❌ 之前：每个用户需要本地安装
- ✅ 现在：部署一次，多人使用

### 跨平台兼容性更好
- ❌ 之前：需要为不同平台构建不同的可执行文件
- ✅ 现在：任何支持现代浏览器的设备都可访问

### 维护更简单
- ❌ 之前：需要维护 Electron 相关配置和依赖
- ✅ 现在：标准的 Node.js + Express 技术栈

## 功能对比

| 功能 | Electron 版本 | Web 版本 |
|------|--------------|----------|
| 文件选择 | ✅ 本地文件对话框 | ✅ 拖拽 + 点击选择 |
| 格式选择 | ✅ | ✅ |
| 处理进度 | ✅ 日志显示 | ✅ 日志显示 |
| 结果访问 | ✅ 打开文件夹 | ✅ 直接下载 |
| CLI 工具 | ✅ | ✅ |
| 多用户支持 | ❌ | ✅ |
| 远程访问 | ❌ | ✅ |
| 移动设备支持 | ❌ | ✅（部分） |

## API 变更

### 之前（Electron IPC）

```javascript
// 前端代码
window.api.selectFile();
window.api.separateAudio(options);
window.api.getFormats();
window.api.openFolder(path);
```

### 现在（REST API）

```javascript
// 前端代码
fetch('/api/formats');
fetch('/api/upload', { method: 'POST', body: formData });
fetch('/api/separate', { method: 'POST', body: JSON.stringify(data) });
// 下载通过 <a> 标签直接链接
```

## 向后兼容性

### CLI 工具保持不变

```bash
# 仍然可以使用 CLI
npm run cli -- --input ./song.mp3 --format wav

# 或全局安装后
vocal-split --input ./song.mp3 --format mp3
```

### 核心逻辑未变更

`src/separate.js` 中的核心音频处理逻辑完全保持不变，确保处理质量一致。

## 迁移后的开发

### 启动开发服务器

```bash
npm start
```

### 调试

```bash
# 查看服务器日志
npm start

# 在浏览器中打开开发者工具
# 访问 http://localhost:3000
# F12 打开控制台
```

### 测试 API

```bash
# 测试格式接口
curl http://localhost:3000/api/formats

# 测试上传
curl -F "audio=@test.mp3" http://localhost:3000/api/upload

# 测试处理
curl -X POST -H "Content-Type: application/json" \
  -d '{"filename":"xxx.mp3","format":"wav"}' \
  http://localhost:3000/api/separate
```

## 生产环境部署

### 使用 PM2

```bash
npm install -g pm2
pm2 start src/server.js --name vocal-splitter
pm2 save
pm2 startup
```

### 使用 Docker

```dockerfile
FROM node:18-alpine
RUN apk add --no-cache ffmpeg
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

### 使用 Nginx 反向代理

```nginx
server {
    listen 80;
    server_name vocal-splitter.example.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 常见问题

### Q: 如何修改端口？
A: 使用环境变量 `PORT=8080 npm start`

### Q: 文件上传大小限制是多少？
A: 默认 500MB，可在 `src/server.js` 中修改 `multer` 配置

### Q: 上传的文件存储在哪里？
A: 临时存储在 `uploads/` 目录，结果在 `outputs/` 目录

### Q: 如何清理旧文件？
A: 可以添加定时任务清理，或手动删除 `uploads/` 和 `outputs/` 目录

### Q: 支持多用户同时使用吗？
A: 支持！每个上传文件都有唯一的文件名，不会冲突

### Q: 可以在生产环境使用吗？
A: 可以，但建议：
   - 使用 HTTPS
   - 添加用户认证
   - 实现文件自动清理
   - 监控磁盘使用情况
   - 使用负载均衡（高并发场景）
