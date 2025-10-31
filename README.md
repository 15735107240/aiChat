# AI+ 聊天应用

一个基于 Vue.js 开发的现代化 AI 聊天应用，提供流畅的对话体验和优雅的用户界面。

## ✨ 功能特性

- 🔐 **手机号验证登录** - 支持手机号验证码登录（开发模式下可使用任意6位数字）
- 💬 **实时流式对话** - 支持 AI 回复的流式输出，使用 Server-Sent Events (SSE) 协议
- 📝 **Markdown 渲染** - 完整支持 Markdown 格式，包括代码块、列表、标题等
- ⚡ **打字机效果** - AI 回复使用逐字打字机效果，正确处理 Unicode 字符（中文、emoji等）
- 🛑 **停止生成** - 支持随时中断 AI 回复生成
- 🎨 **文字生图** - 切换文字生图模式，根据描述生成图片并展示
- 📜 **历史记录** - 自动加载聊天历史记录，支持分页滚动加载更多
- 🎨 **现代化 UI** - 采用渐变色设计，卡片式聊天气泡，输入框区域美观整洁
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

**文字聊天接口：**
```
GET /api/simple/chat?query={消息内容}&conversantId={用户手机号}
```

**文字生图接口：**
```
GET /api/simple/image?query={图片描述}&conversantId={用户手机号}
```

**历史记录接口：**
```
GET /api/history/{用户ID}/page?page={页码}&size={每页数量}
```

**接口返回格式：**
- Chat 接口：SSE 流式返回，每个 `data:` 事件包含 JSON 对象
  ```json
  {
    "results": [{
      "output": {
        "content": "回复内容",
        "text": "回复内容"
      }
    }],
    "result": {
      "output": {
        "content": "回复内容",
        "text": "回复内容"
      }
    }
  }
  ```
- Image 接口：返回 JSON，包含图片 URL
- History 接口：返回分页的历史消息列表

## 🎯 使用说明

### 登录
1. 打开应用后进入登录页面
2. 输入手机号（开发模式下任意手机号即可）
3. 点击"发送验证码"，输入任意6位数字
4. 点击"开始对话"进入聊天界面

### 聊天功能
1. **文字聊天**：在输入框输入消息，点击发送按钮或按 Enter 键发送
2. **文字生图**：点击"文字生图"按钮切换到图片生成模式，输入图片描述后发送
3. **查看历史**：进入聊天界面后自动加载最近的聊天记录
4. **加载更多**：向上滚动到顶部，自动加载更早的聊天记录
5. **停止生成**：在 AI 回复生成过程中，点击发送按钮可以停止生成

### 快捷键
- **Enter**：发送消息
- **停止按钮**：生成中时显示为停止按钮，点击可中断

## 🎨 界面特色

- **渐变紫色主题** - 采用优雅的紫色渐变设计
- **现代化输入框** - 白色卡片式输入区域，按钮圆润美观
- **差异化气泡** - 用户消息和 AI 回复使用不同的样式区分
- **流畅动画** - 打字机效果和滚动动画流畅自然
- **代码高亮** - Markdown 代码块自动格式化显示
- **智能换行** - 支持长文本自动换行，确保内容完整显示

## 📝 技术细节

### SSE 数据处理
- 空 `data:` 表示换行符
- 从 `results[].output.content` 或 `result.output.content` 中提取内容
- 支持流式接收和处理

### 历史记录
- 分页从 1 开始
- 支持向上滚动自动加载更多
- 自动去重和验证消息有效性
- 消息按时间顺序正确排列

### 多环境支持
- 开发环境：使用代理，避免 CORS 问题
- 生产环境：直接请求远程 API
- 通过环境变量灵活配置

## 📝 待办事项

- [ ] 支持多轮对话上下文
- [ ] 添加消息复制功能
- [ ] 支持图片上传
- [ ] 添加主题切换功能
- [ ] 优化移动端适配
- [ ] 添加消息搜索功能

## 📄 许可证

本项目仅供学习和研究使用。

## 🔗 相关链接

- [Vue.js 文档](https://v2.vuejs.org/)
- [Vue CLI 配置参考](https://cli.vuejs.org/config/)
- [Marked.js 文档](https://marked.js.org/)
