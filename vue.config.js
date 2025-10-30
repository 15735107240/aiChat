const { defineConfig } = require('@vue/cli-service')

// 从环境变量获取代理目标地址，默认为 localhost:10010
const proxyTarget = process.env.VUE_APP_PROXY_TARGET || 'http://localhost:10010'

module.exports = defineConfig({
  transpileDependencies: true,
  devServer: {
    proxy: {
      '/api': {
        target: proxyTarget,
        changeOrigin: true,
        pathRewrite: {
          // 如果需要重写路径，可以在这里配置
          // '^/api': ''
        }
      }
    }
  },
  // 生产环境构建配置
  productionSourceMap: process.env.NODE_ENV !== 'production'
})
