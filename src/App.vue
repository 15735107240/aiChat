<template>
  <div id="app">
    <router-view />
  </div>
  </template>

<script>
export default {
  name: 'App',
}
</script>

<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  color: #2c3e50;
}
html, body, #app {
  height: 100%;
}
html, body {
  margin: 0;
  padding: 0;
  overflow: hidden; /* 禁用页面层级滚动 */
  overscroll-behavior: none; /* 禁用回弹和下拉刷新 */
  touch-action: manipulation; /* 禁止双指缩放/双击缩放 */
}
</style>
