import Vue from 'vue'
import Router from 'vue-router'
import { isAuthenticated } from '@/utils/api'

import Login from '@/views/Login.vue'
import Chat from '@/views/Chat.vue'

Vue.use(Router)

const router = new Router({
  mode: 'history',
  routes: [
    {
      path: '/',
      name: 'Login',
      component: Login
    },
    {
      path: '/chat',
      name: 'Chat',
      component: Chat,
      meta: { requiresAuth: true }
    }
  ]
})

// 全局导航守卫：检查登录状态
router.beforeEach((to, from, next) => {
  // 如果路由需要认证
  if (to.matched.some(record => record.meta.requiresAuth)) {
    // 检查是否已登录
    if (!isAuthenticated()) {
      // 未登录，跳转到登录页，并记录目标路由
      next({
        name: 'Login',
        query: { redirect: to.fullPath }
      })
    } else {
      // 已登录，继续
      next()
    }
  } else {
    // 不需要认证的路由，直接继续
    next()
  }
})

export default router


