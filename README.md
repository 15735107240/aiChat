# AI+ 聊天应用

一个基于 Vue.js 开发的现代化 AI 聊天应用，提供流畅的对话体验和优雅的用户界面。

## ✨ 功能特性

- 🔐 **手机号验证登录** - 支持手机号验证码登录（开发模式下可使用任意6位数字）
- 💬 **实时流式对话** - 支持 AI 回复的流式输出，模拟真实打字效果
- 📝 **Markdown 渲染** - 完整支持 Markdown 格式，包括代码块、列表、标题等
- ⚡ **打字机效果** - AI 回复使用逐字打字机效果，提升用户体验
- 🛑 **停止生成** - 支持随时中断 AI 回复生成
- 🎨 **现代化 UI** - 采用渐变色设计，卡片式聊天气泡，视觉效果出色
- 📱 **响应式设计** - 完美适配移动端和桌面端

## 🛠️ 技术栈

- **框架**: Vue 2.6.14
- **路由**: Vue Router 3.6.5
- **Markdown**: marked 16.4.1
- **安全**: DOMPurify 3.3.0（防止 XSS 攻击）
- **构建工具**: Vue CLI 5.0
- **代码规范**: ESLint

## 📦 安装

```bash
# 使用 yarn（推荐）
yarn install

# 或使用 npm
npm install
```

## 🚀 开发

```bash
# 启动开发服务器（开发环境，使用本地代理）
yarn serve

# 访问 http://localhost:8080
```

## 🏗️ 构建

```bash
# 构建生产版本（默认）
yarn build

# 构建开发环境版本
yarn build:dev

# 构建文件将输出到 dist 目录
```

## 📋 其他命令

```bash
# 代码检查和自动修复
yarn lint
```

## 📁 项目结构

```
aichat/
├── src/
│   ├── views/
│   │   ├── Login.vue      # 登录页面
│   │   └── Chat.vue       # 聊天页面
│   ├── router/
│   │   └── index.js       # 路由配置
│   ├── App.vue            # 根组件
│   └── main.js            # 入口文件
├── public/                # 静态资源
└── dist/                  # 构建输出目录
```

## 🔧 配置

### 环境配置

项目支持两个环境：**开发环境**和**生产环境**。

**环境列表：**
- **开发环境 (development)**: 本地开发，使用代理到 `localhost:10010`
- **生产环境 (production)**: 正式部署，API 地址为 `http://8.148.185.212/apifox`

**配置文件：**
- `.env.development` - 开发环境配置
- `.env.production` - 生产环境配置
- `.env.local` - 本地自定义配置（可选，不提交到 Git）

### API 配置

**开发环境** (`.env.development`)：
```bash
NODE_ENV=development
VUE_APP_API_BASE=
VUE_APP_PROXY_TARGET=http://localhost:10010
```
- 使用相对路径，通过 Vue CLI 代理转发到本地后端
- 避免跨域问题

**生产环境** (`.env.production`)：
```bash
NODE_ENV=production
VUE_APP_API_BASE=http://8.148.185.212/apifox
```
- 使用完整的 API 地址
- 直接请求远程服务器

### 聊天 API

应用使用 Server-Sent Events (SSE) 实现流式对话：

```
GET /api/simple/chat?query={消息内容}&conversantId={用户手机号}
```

## 🎯 使用说明

1. 打开应用后进入登录页面
2. 输入手机号（开发模式下任意手机号即可）
3. 点击"发送验证码"，输入任意6位数字
4. 点击"开始对话"进入聊天界面
5. 在输入框输入消息，与 AI 开始对话
6. 可以随时点击"停止"按钮中断 AI 回复

## 🎨 界面特色

- **渐变紫色主题** - 采用优雅的紫色渐变设计
- **差异化气泡** - 用户消息和 AI 回复使用不同的样式区分
- **流畅动画** - 打字机效果和滚动动画流畅自然
- **代码高亮** - Markdown 代码块自动格式化显示

## 📝 待办事项

- [ ] 添加对话历史记录
- [ ] 支持多轮对话上下文
- [ ] 添加消息复制功能
- [ ] 支持图片上传
- [ ] 添加主题切换功能
- [ ] 优化移动端适配

## 📄 许可证

本项目仅供学习和研究使用。

## 🔗 相关链接

- [Vue.js 文档](https://v2.vuejs.org/)
- [Vue CLI 配置参考](https://cli.vuejs.org/config/)
- [Marked.js 文档](https://marked.js.org/)
