# 更新日志

## [1.0.0] - Web 应用版本

### 🎉 重大更新

从 Electron 桌面应用完全迁移为纯 Web 应用！

### ✨ 新增功能

- **Web 服务器**: 基于 Express.js 的 HTTP 服务器
- **REST API**: 完整的 RESTful API 接口
  - `GET /api/formats` - 获取支持的输出格式
  - `POST /api/upload` - 上传音频文件
  - `POST /api/separate` - 处理音频分离
  - `GET /api/download/:filename` - 下载结果文件
- **拖拽上传**: 支持拖放文件或点击选择
- **直接下载**: 处理完成后直接下载结果，无需打开文件夹
- **文件信息显示**: 显示文件名和大小
- **改进的用户界面**: 优化的拖拽体验和视觉反馈

### 🗑️ 删除内容

- 移除 Electron 依赖（节省 ~200MB 安装空间）
- 删除 `src/gui.js`（Electron 主进程）
- 删除 `src/preload.js`（Electron IPC 桥接）
- 删除 `gui` npm script

### 🔄 变更内容

- **package.json**:
  - `start` 脚本现在启动 Web 服务器
  - 添加 `cli` 脚本用于命令行工具
  - 新增依赖: express, multer, cors
  - 移除依赖: electron
- **public/index.html**: 重构为支持拖拽上传的 Web 界面
- **public/renderer.js**: 完全重写，使用 fetch API 替代 Electron IPC
- **public/style.css**: 添加拖拽区域和下载按钮样式
- **.gitignore**: 添加 uploads/, outputs/, output/ 目录

### 📚 新增文档

- **README.md**: 完整的安装和使用文档
- **MIGRATION.md**: 从 Electron 迁移指南
- **CHANGELOG.md**: 本更新日志

### ⚙️ 技术细节

#### 文件存储
- 上传文件临时存储在 `uploads/` 目录
- 处理结果输出到 `outputs/` 目录
- 文件名添加时间戳避免冲突

#### API 设计
- RESTful 风格
- JSON 响应格式
- 支持 CORS
- 文件大小限制: 500MB（可配置）

#### 前端改进
- 拖拽上传支持
- 视觉反馈（拖拽时高亮）
- 文件大小格式化显示
- 下载按钮样式优化

### 🎨 UI/UX 改进

- 保持赛博朋克霓虹风格
- 拖拽区域动画效果
- 文件选择后的视觉确认
- 下载按钮 hover 效果
- 响应式设计优化

### 🚀 性能优化

- 更快的安装速度（无 Electron 下载）
- 更小的包体积
- 支持多用户并发使用
- 可部署到服务器供多人访问

### 🔧 开发体验

- 简化的技术栈（纯 Node.js + Express）
- 标准的 REST API 开发模式
- 更容易调试（浏览器开发者工具）
- 更容易部署（标准 Node.js 应用）

### 📦 安装变化

#### 之前
```bash
npm install  # 下载 ~200MB Electron
npm run gui  # 启动桌面应用
```

#### 现在
```bash
npm install  # 下载 ~5MB 依赖
npm start    # 启动 Web 服务器
# 浏览器访问 http://localhost:3000
```

### 🔒 保持不变

- ✅ CLI 命令行工具完全保留
- ✅ 核心音频处理逻辑未变
- ✅ FFmpeg 集成方式相同
- ✅ 支持的音频格式相同
- ✅ 输出文件质量相同
- ✅ 处理速度相同

### 🎯 迁移路径

对于现有用户，迁移非常简单：

1. 拉取最新代码
2. 重新安装依赖: `npm install`
3. 启动服务器: `npm start`
4. 在浏览器访问: `http://localhost:3000`

详细迁移指南请参考 [MIGRATION.md](./MIGRATION.md)

### 🐛 已知问题

- 上传大文件时可能需要较长时间（取决于网络和硬盘速度）
- 需要手动清理 uploads/ 和 outputs/ 目录中的旧文件
- 移动设备支持有限（文件上传可能受限）

### 📝 后续计划

- [ ] 添加文件自动清理机制
- [ ] 添加处理进度实时更新
- [ ] 添加批量处理支持
- [ ] 添加用户认证功能
- [ ] 优化移动端体验
- [ ] 添加 Docker 支持
- [ ] 添加单元测试

---

## 贡献者

感谢所有为这次重大更新做出贡献的开发者！

## 反馈

如有任何问题或建议，请在 GitHub 仓库提交 Issue。
