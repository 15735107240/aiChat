/**
 * API 工具类
 * 统一处理 API 请求，包括认证、错误处理等
 */

// Token 存储键名
const TOKEN_KEY = 'accessToken'
const USER_KEY = 'userInfo'

/**
 * 获取 API 基础地址
 * 移除代理，直接使用 CORS 跨域访问后端
 */
function getApiBase() {
  // 开发环境使用相对路径（通过代理），生产环境使用环境变量配置的完整地址
  const isDev = process.env.NODE_ENV === 'development'
  return isDev ? '' : (process.env.VUE_APP_API_BASE || '')
}

/**
 * 获取访问令牌
 */
export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

/**
 * 设置访问令牌
 */
export function setToken(token) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token)
  } else {
    localStorage.removeItem(TOKEN_KEY)
  }
}

/**
 * 获取用户信息
 */
export function getUserInfo() {
  const userStr = localStorage.getItem(USER_KEY)
  return userStr ? JSON.parse(userStr) : null
}

/**
 * 设置用户信息
 */
export function setUserInfo(user) {
  if (user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user))
  } else {
    localStorage.removeItem(USER_KEY)
  }
}

/**
 * 清除认证信息（token 和用户信息）
 */
export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

/**
 * 检查是否已登录
 */
export function isAuthenticated() {
  return !!getToken()
}

/**
 * 处理认证失败，跳转到登录页
 */
function handleAuthError() {
  clearAuth()
  // 如果已经在登录页，则不跳转
  if (window.location.pathname !== '/' && window.location.pathname !== '/login') {
    // 使用 window.location.href 进行跳转，确保页面完全刷新
    // 这样 Vue Router 的导航守卫会重新执行，检查登录状态
    window.location.href = '/'
  }
}

/**
 * 统一的 fetch 封装
 * 自动添加 Authorization 请求头，处理认证错误
 */
export async function request(url, options = {}) {
  const apiBase = getApiBase()
  const fullUrl = url.startsWith('http') ? url : `${apiBase}${url}`
  
  // 构建请求头
  // 默认 Content-Type，但用户指定的请求头优先（覆盖默认值）
  const headers = {
    ...options.headers
  }
  
  // 如果没有指定 Content-Type，且请求方法需要 body，则设置默认值
  if (!headers['Content-Type'] && !headers['content-type'] && 
      options.method && options.method !== 'GET' && options.method !== 'HEAD') {
    headers['Content-Type'] = 'application/json'
  }
  
  // 如果有 token，添加 Authorization 请求头
  const token = getToken()
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  
  // 合并请求选项
  const fetchOptions = {
    ...options,
    headers
  }
  
  try {
    const response = await fetch(fullUrl, fetchOptions)
    
    // 处理认证错误（401 未授权，403 禁止访问）
    if (response.status === 401 || response.status === 403) {
      handleAuthError()
      throw new Error('登录已过期，请重新登录')
    }
    
    return response
  } catch (error) {
    // 如果是认证错误，已经处理过，直接抛出
    if (error.message === '登录已过期，请重新登录') {
      throw error
    }
    // 网络错误或其他错误
    throw error
  }
}

/**
 * GET 请求
 */
export async function get(url, options = {}) {
  // GET 请求不需要 Content-Type，移除默认的 Content-Type
  const { headers, ...restOptions } = options
  return request(url, {
    method: 'GET',
    ...restOptions,
    headers: headers || {}
  })
}

/**
 * POST 请求
 */
export async function post(url, data, options = {}) {
  return request(url, {
    method: 'POST',
    body: JSON.stringify(data),
    ...options
  })
}

/**
 * PUT 请求
 */
export async function put(url, data, options = {}) {
  return request(url, {
    method: 'PUT',
    body: JSON.stringify(data),
    ...options
  })
}

/**
 * DELETE 请求
 */
export async function del(url, options = {}) {
  return request(url, {
    method: 'DELETE',
    ...options
  })
}

/**
 * 获取验证码
 * POST /api/auth/code
 */
export async function getAuthCode(phoneNumber) {
  const response = await post('/api/auth/code', { phoneNumber })
  if (!response.ok) {
    let errorMessage = `HTTP ${response.status}`
    try {
      const error = await response.json()
      // 接口可能返回 { message: "..." } 或 { success: false, message: "..." }
      errorMessage = error.message || error.error || errorMessage
    } catch (e) {
      // 如果解析 JSON 失败，使用默认错误信息
    }
    throw new Error(errorMessage)
  }
  return response.json()
}

/**
 * 登录
 * POST /api/auth/login
 */
export async function login(phoneNumber, code) {
  const response = await post('/api/auth/login', { phoneNumber, code })
  if (!response.ok) {
    let errorMessage = `HTTP ${response.status}`
    try {
      const error = await response.json()
      // 接口可能返回 { message: "..." } 或 { success: false, message: "..." }
      errorMessage = error.message || error.error || errorMessage
    } catch (e) {
      // 如果解析 JSON 失败，使用默认错误信息
    }
    throw new Error(errorMessage)
  }
  const data = await response.json()
  // 保存 token
  if (data.accessToken) {
    setToken(data.accessToken)
  }
  return data
}

/**
 * 获取当前用户信息
 * GET /api/auth/user
 */
export async function getCurrentUser() {
  const response = await get('/api/auth/user')
  if (!response.ok) {
    let errorMessage = `HTTP ${response.status}`
    try {
      const error = await response.json()
      // 接口可能返回 { message: "..." } 或 { success: false, message: "..." }
      errorMessage = error.message || error.error || errorMessage
    } catch (e) {
      // 如果解析 JSON 失败，使用默认错误信息
    }
    throw new Error(errorMessage)
  }
  const data = await response.json()
  // 保存用户信息
  if (data.user) {
    setUserInfo(data.user)
  }
  return data
}

/**
 * 登出
 * POST /api/auth/logout
 */
export async function logout() {
  const response = await post('/api/auth/logout')
  if (!response.ok) {
    let errorMessage = `HTTP ${response.status}`
    try {
      const error = await response.json()
      errorMessage = error.message || error.error || errorMessage
    } catch (e) {
      // 如果解析 JSON 失败，使用默认错误信息
    }
    throw new Error(errorMessage)
  }
  const data = await response.json()
  // 清除本地认证信息
  clearAuth()
  return data
}
