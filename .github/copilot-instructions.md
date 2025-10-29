## 快速说明（给 AI 代理）

下面是让你能快速在此仓库里安全、有效地修改代码的要点：架构、常用命令、代码约定和示例路径引用。优先遵循现有文件（例如 `package.json` 中的 scripts 和 `jsconfig.json` 的路径别名）。

### 一句概览
这是一个基于 Vue 2 + Vue CLI（单页应用）的前端样板工程。入口：`src/main.js`，主组件：`src/App.vue`，示例组件：`src/components/HelloWorld.vue`。

### 关键命令（由 `package.json` 定义）
- 开发（热重载）：`yarn serve` 或 `npm run serve`
- 打包发布：`yarn build` 或 `npm run build`
- 代码检查：`yarn lint` 或 `npm run lint`

注：README 中用的是 `yarn`，但 `package.json` 的 scripts 可通过 npm 等价调用。

### 项目结构与重要文件
- `src/main.js`：Vue 根实例，挂载点为 `#app`（由 `public/index.html` 提供）。
- `src/App.vue`：主视图，注册并使用 `src/components/HelloWorld.vue`。
- `src/components/`：放置单文件组件（.vue）。遵循 Vue 单文件组件模式（template/script/style）。
- `src/assets/`：静态资源（如 logo.png），通过相对路径在 .vue 中引用。
- `public/index.html`：应用 HTML 壳，`#app` 挂载点。
- `vue.config.js`：自定义 webpack 配置（若需要改构建或代理，在此修改）。
- `babel.config.js`：babel 转译配置。
- `jsconfig.json`：配置了 `@/*` -> `src/*` 的路径别名，AI 修改导入时优先使用 `@/`。

### 代码约定 / 可被发现的风格
- Vue 版本：2.6.x（注意 `vue` 与 `vue-template-compiler` 版本需匹配）。
- ESLint：已启用（配置在 `package.json` 的 `eslintConfig`），遵循 `plugin:vue/essential` 与 `eslint:recommended`。
- 组件风格：props 在 `export default` 中声明（见 `HelloWorld.vue`），样式优先使用 `scoped` 限定局部样式。

### 可执行更改的具体示例（AI 可直接执行）
- 新增组件：在 `src/components/` 新建 `MyWidget.vue`（SFC），在需要处按 `import MyWidget from '@/components/MyWidget.vue'` 注册并使用。
- 添加路由：此项目当前未包含 `vue-router`，如需增加路由，先在 `package.json` 中添加依赖并在 `src/main.js` 中创建 router 实例。
- 修改构建参数：编辑 `vue.config.js`，例如添加 devServer.proxy 用于本地 API 代理。

### 常见注意事项（避免回退或破坏构建）
- 不要单独升级 `vue` 到 3.x：若升级必须同时替换大范围依赖（`vue-template-compiler`、CLI 插件）且会引入破坏性变更。
- 若改动依赖版本，运行一次完整本地构建（`yarn build`）以捕获构建错误。
- 保持 `jsconfig.json` 中 `@/` 别名与改动一致，IDE 路径和相对导入都依赖它。

### 调试与验证
- 开发期用 `yarn serve` 并在浏览器打开 `http://localhost:8080`（默认端口），查看控制台与终端错误。
- 在修改 ESLint 规则或代码后，用 `yarn lint` 检查样式问题。

### 当你需要更多信息
- 仅读取文件即可总结发现的约定和模式；若遇到未在仓库中声明的外部服务或凭据，停止并请求人工确认。

如果你希望我把某一段现有 README 内容合并或保留到这里（例如项目历史或贡献指南），或者需要把说明改写成英文，请告诉我想保留的部分或目标语言。

---
请检查以上内容是否覆盖了你想要 AI 代理遵循的重点，我会根据反馈迭代更新。
