# 环境配置说明

本项目支持两个环境：**开发环境**和**生产环境**。

## 环境列表

### 1. 开发环境 (development)
- **配置文件**: `.env.development`
- **特点**: 使用本地代理，支持热重载，避免跨域问题
- **API地址**: 通过代理转发到 `http://localhost:10010`
- **使用场景**: 本地开发和调试

### 2. 生产环境 (production)
- **配置文件**: `.env.production`
- **特点**: 正式生产环境，直接请求远程 API
- **API地址**: `http://8.148.185.212/apifox`
- **使用场景**: 正式部署到服务器

## 命令使用

### 开发命令

```bash
# 启动开发环境（默认）
yarn serve
# 或
npm run serve
```

### 构建命令

```bash
# 构建生产环境（默认）
yarn build
# 或
npm run build

# 构建开发环境版本
yarn build:dev
# 或
npm run build:dev
```

## 环境变量说明

### VUE_APP_API_BASE
API 请求的基础地址。

- **开发环境**: 留空（使用代理）
- **生产环境**: `http://8.148.185.212/apifox`

### VUE_APP_PROXY_TARGET
开发环境代理目标地址。

- **仅在开发环境有效**
- **值**: `http://localhost:10010`

## 配置文件内容

### 开发环境 (.env.development)
```env
NODE_ENV=development
VUE_APP_API_BASE=
VUE_APP_PROXY_TARGET=http://localhost:10010
```

### 生产环境 (.env.production)
```env
NODE_ENV=production
VUE_APP_API_BASE=http://8.148.185.212/apifox
```

## 自定义配置

如果需要本地自定义配置，可以创建 `.env.local` 文件，该文件不会被 Git 追踪。

```bash
# 复制示例文件
cp .env.example .env.local

# 然后修改 .env.local 中的配置
```

## 代码实现

在 `Chat.vue` 中，通过计算属性统一管理 API 地址：

```javascript
computed: {
  apiBase() {
    // 开发环境使用相对路径（通过代理），生产环境使用环境变量配置的完整地址
    const isDev = process.env.NODE_ENV === 'development'
    return isDev ? '' : process.env.VUE_APP_API_BASE
  }
}
```

请求时使用：
```javascript
const url = `${this.apiBase}/api/simple/chat?query=${query}`
```

## 注意事项

1. **环境变量前缀**: 所有自定义环境变量必须以 `VUE_APP_` 开头
2. **重启服务**: 修改环境变量后需要重启开发服务器
3. **安全性**: 不要在环境变量中存储敏感信息，如密钥、token 等
4. **跨域问题**: 开发环境使用代理避免跨域，生产环境需要后端配置 CORS

## 工作原理

### 开发环境
1. 前端请求相对路径：`/api/simple/chat`
2. Vue CLI 代理拦截请求
3. 转发到 `http://localhost:10010/api/simple/chat`
4. 避免浏览器跨域限制

### 生产环境
1. 前端请求完整路径：`http://8.148.185.212/apifox/api/simple/chat`
2. 直接请求远程服务器
3. 需要后端支持 CORS

## 部署步骤

### 生产环境部署
```bash
# 1. 构建生产版本
yarn build

# 2. 将 dist 目录上传到服务器
# 3. 配置 Nginx 或其他 Web 服务器
```

### 修改生产环境 API 地址
如果需要修改生产环境的 API 地址，编辑 `.env.production` 文件：
```env
VUE_APP_API_BASE=http://your-api-domain.com
```
然后重新构建即可。

