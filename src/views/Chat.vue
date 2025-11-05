<template>
  <div class="chat-wrap">
    <header class="topbar">
      <button class="icon-btn" @click="handleLogout" :title="'登出'">
        <svg class="logout-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.59L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"
            fill="currentColor" />
        </svg>
      </button>
      <div class="brand">AI+</div>
      <div class="spacer"></div>
    </header>

    <main class="messages" ref="messages" @scroll="handleScroll">
      <div v-if="loadingHistory && historyPage > 1" class="loading-more">加载中...</div>
      <div v-if="loadingHistory && messages.length === 0" class="loading-tip">加载中...</div>
      <div v-for="(m, i) in messages" :key="m.id || `msg-${i}`" class="message" :class="m.role">
        <div class="avatar" aria-hidden="true">{{ m.role === 'user' ? '我' : 'AI' }}</div>
        <div class="content">
          <div v-if="m.role === 'user'" class="bubble user-bubble">
            <span class="chip" v-if="m.tag">{{ m.tag }}</span>
            {{ m.text }}
          </div>
          <div v-else class="card ai-card">
            <div v-if="m.isImage && m.imageUrl" class="image-container">
              <img 
                :src="m.imageUrl" 
                alt="生成的图片" 
                class="generated-image"
                @load="scrollToBottom"
                @error="handleImageError($event, m)"
              />
            </div>
            <div v-else-if="m.isImage && !m.imageUrl" class="markdown">
              <p>{{ m.text || '正在生成图片...' }}</p>
            </div>
            <div v-else class="markdown" v-html="renderMarkdown(m.text)"></div>
          </div>
        </div>
      </div>
    </main>

    <div class="composer">
      <form class="composer-card" @submit.prevent="send">
        <div class="input-container">
          <input
            v-model.trim="input"
            type="text"
            :placeholder="isImageMode ? '描述你想生成的图片...' : '给 AI+ 发送消息'"
            :disabled="loading"
            class="main-input"
          />
          <div class="input-actions">
            <button 
              type="button" 
              class="mode-btn" 
              :class="{ active: isImageMode }"
              @click="toggleMode"
              :disabled="loading"
            >
              <svg class="icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" fill="currentColor"/>
              </svg>
              文字生图
            </button>
            <button 
              v-if="loading"
              type="button"
              class="send-btn"
              @click="stop"
              :title="'停止生成'"
            >
              <svg class="send-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="7" y="7" width="10" height="10" rx="1" fill="currentColor"/>
              </svg>
            </button>
            <button 
              v-else
              type="submit" 
              class="send-btn" 
              :disabled="!input || loading || isSending"
              :title="'发送'"
            >
              <svg class="send-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z" fill="currentColor"/>
              </svg>
            </button>
          </div>
        </div>
        <div class="disclaimer">内容由 AI 生成，请仔细甄别</div>
      </form>
    </div>
  </div>
  </template>

<script>
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import { fetchEventSource } from '@microsoft/fetch-event-source'
import { get, getUserInfo, logout, clearAuth, getToken } from '@/utils/api'

export default {
  name: 'ChatPage',
  data() {
    return {
      input: '',
      loading: false,
      controller: null,
      isImageMode: false,
      // 打字机缓冲与节流
      pendingText: '',
      typingTimer: null,
      typingSpeedMs: 20,
      displayedCharCount: 0, // 记录已经显示的字符数（用于打字机效果）
      messages: [],
      // 组件销毁标志，用于防止在组件销毁后继续处理数据
      isDestroyed: false,
      // 历史记录分页（分页从1开始）
      historyPage: 1,
      historySize: 10,
      hasMoreHistory: true,
      loadingHistory: false,
      scrollTimer: null,
      // 请求锁，防止重复发送
      isSending: false,
      // 当前正在处理的请求内容（用于去重）
      currentRequestText: null
    }
  },
  computed: {
    // 统一的 API 基础地址配置
    apiBase() {
      // 开发环境使用相对路径（通过代理），生产环境使用环境变量配置的完整地址
      const isDev = process.env.NODE_ENV === 'development'
      return isDev ? '' : process.env.VUE_APP_API_BASE
    },
    // 从用户信息中获取 conversantId（使用 user.username 字段）
    conversantId() {
      const userInfo = getUserInfo()
      return userInfo?.username || ''
    },
    conversantIdDisplay() {
      return this.conversantId ? `用户：${this.conversantId}` : '未提供用户信息'
    },
    // 获取当前登录的用户ID，用于历史记录接口
    // 从用户信息中获取 username 字段
    username() {
      const userInfo = getUserInfo()
      return userInfo?.username || ''
    }
  },
  mounted() {
    // 重置所有状态标志
    this.isDestroyed = false
    this.isSending = false
    this.currentRequestText = null
    this.loading = false
    this.loadHistory()
  },
  beforeDestroy() {
    // 标记组件已销毁
    this.isDestroyed = true
    
    // 清理定时器
    if (this.scrollTimer) {
      clearTimeout(this.scrollTimer)
      this.scrollTimer = null
    }
    if (this.typingTimer) {
      clearInterval(this.typingTimer)
      this.typingTimer = null
    }
    
    // 中断正在进行的请求
    if (this.controller) {
      this.controller.abort()
      this.controller = null
    }
    
    // 重置状态和锁
    this.loading = false
    this.isSending = false
    this.currentRequestText = null
    this.pendingText = ''
    this.displayedCharCount = 0
  },
  methods: {
    // 滚动事件处理，实现分页加载
    handleScroll(e) {
      const el = e.target
      
      // 防抖处理
      if (this.scrollTimer) {
        clearTimeout(this.scrollTimer)
      }
      
      this.scrollTimer = setTimeout(() => {
        // 当滚动到顶部附近时加载更多
        if (el.scrollTop < 100 && this.hasMoreHistory && !this.loadingHistory) {
          this.loadMoreHistory()
        }
      }, 200)
    },
    // 加载历史记录
    // 接口：/api/history/{userId}/page?page=1&size=10
    // 分页从1开始，userId为当前登录的用户ID
    async loadHistory() {
      if (this.loadingHistory || !this.hasMoreHistory) return
      
      this.loadingHistory = true
      try {
        // 构建接口URL：/api/history/{userId}/page?page={page}&size={size}
        // 分页从1开始
        const url = `/api/history/${this.username}/page?page=${this.historyPage}&size=${this.historySize}`
        const res = await get(url)
        
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`)
        }
        
        const data = await res.json()
        
        // 处理接口返回的数据格式
        // 格式: { messages: [...], hasNext: true, totalPages: 2, page: 1, ... }
        let historyList = []
        let hasMore = false
        
        if (data.messages && Array.isArray(data.messages)) {
          // 标准格式：messages 数组
          historyList = data.messages
          // 使用 hasNext 判断是否还有下一页
          hasMore = data.hasNext === true
          // 也可以根据 page 和 totalPages 判断
          if (data.totalPages !== undefined && data.page !== undefined) {
            hasMore = data.page < data.totalPages
          }
        } else if (Array.isArray(data)) {
          // 如果直接返回数组（兼容旧格式）
          historyList = data
          hasMore = data.length >= this.historySize
        } else if (data.data && Array.isArray(data.data)) {
          // 兼容格式: { data: [...], total: 100 }
          historyList = data.data
          hasMore = data.data.length >= this.historySize
          if (data.total !== undefined) {
            hasMore = (this.historyPage * this.historySize) < data.total
          }
        } else if (data.list && Array.isArray(data.list)) {
          // 兼容格式: { list: [...], total: 100 }
          historyList = data.list
          hasMore = data.list.length >= this.historySize
          if (data.total !== undefined) {
            hasMore = (this.historyPage * this.historySize) < data.total
          }
        } else if (data.records && Array.isArray(data.records)) {
          // 兼容格式: { records: [...], total: 100 }
          historyList = data.records
          hasMore = data.records.length >= this.historySize
          if (data.total !== undefined) {
            hasMore = (this.historyPage * this.historySize) < data.total
          }
        }
        
        if (historyList.length === 0) {
          // 如果没有历史记录，显示欢迎消息
          if (this.historyPage === 1 && this.messages.length === 0) {
            this.messages = [{ role: 'ai', text: '你好，我是 AI，有什么想聊的吗？' }]
          }
          this.hasMoreHistory = false
        } else {
          // 格式化历史记录并添加到消息列表
          const formattedMessages = this.formatHistoryMessages(historyList)
          
          // 根据用户提供的数据，接口返回的 messages 是倒序的（最新的在前）
          // 但我们需要正序显示（最早的在顶部，最新的在底部）
          // 所以第一页需要反转，让最新的消息在底部
          
          if (this.historyPage === 1) {
            // 第一页：接口返回倒序（最新的在前），反转后变成正序（最早的在顶部，最新的在底部）
            // 反转数组，让最早的消息在顶部，最新的消息在底部
            const reversedMessages = [...formattedMessages].reverse()
            
            // 根据时间戳排序，确保顺序完全正确
            const sortedMessages = reversedMessages.sort((a, b) => {
              if (a.timestamp && b.timestamp) {
                return new Date(a.timestamp) - new Date(b.timestamp)
              }
              // 如果没有时间戳，保持反转后的顺序
              return 0
            })
            
            this.messages = sortedMessages
            this.$nextTick(() => {
              this.scrollToBottom()
            })
          } else {
            // 加载更多（更早的消息，第二页、第三页等）
            // 新页的数据也是倒序的（该页中最新的在前），需要反转后添加到顶部
            // 这样最旧的消息会显示在顶部，保持正确的时间顺序
            const currentScrollTop = this.$refs.messages.scrollTop
            const currentScrollHeight = this.$refs.messages.scrollHeight
            
            // 反转新加载的消息，让最旧的在前，然后添加到顶部
            // formattedMessages 已经通过 isValidMessage 过滤掉了错误的消息
            const reversedNewMessages = [...formattedMessages].reverse()
            
            this.messages = [...reversedNewMessages, ...this.messages]
            
            this.$nextTick(() => {
              // 保持滚动位置，避免跳动
              const newScrollHeight = this.$refs.messages.scrollHeight
              this.$refs.messages.scrollTop = currentScrollTop + (newScrollHeight - currentScrollHeight)
            })
          }
          
          this.hasMoreHistory = hasMore
        }
      } catch (e) {
        console.error('加载历史记录失败:', e)
        if (this.historyPage === 1 && this.messages.length === 0) {
          this.messages = [{ role: 'ai', text: '你好，我是 AI，有什么想聊的吗？' }]
        }
      } finally {
        this.loadingHistory = false
      }
    },
    // 加载更多历史记录（下一页）
    // 分页从1开始，每次加载下一页时递增页码
    async loadMoreHistory() {
      if (!this.hasMoreHistory || this.loadingHistory) return
      // 页码递增，从1开始：1 -> 2 -> 3 ...
      this.historyPage++
      await this.loadHistory()
    },
    // 验证消息是否有效，过滤掉错误的消息
    isValidMessage(item) {
      // 检查消息对象是否存在
      if (!item || typeof item !== 'object') {
        return false
      }
      
      // 必须要有 messageType（标准格式）或 role（兼容格式）
      if (!item.messageType && !item.role && item.type !== 'user') {
        return false
      }
      
      // messageType 必须是 USER 或 ASSISTANT，不能是其他值
      if (item.messageType) {
        if (item.messageType !== 'USER' && item.messageType !== 'ASSISTANT') {
          return false
        }
      }
      
      // 必须有有效的内容或媒体
      const content = item.content || item.text || item.message || ''
      const hasMedia = item.media && Array.isArray(item.media) && item.media.length > 0
      
      // 内容不能为空（除非有媒体）
      if (!content.trim() && !hasMedia) {
        return false
      }
      
      // 如果内容只是空白字符，也视为无效
      if (content.trim().length === 0 && !hasMedia) {
        return false
      }
      
      return true
    },
    // 格式化历史记录数据为消息格式
    // 接口返回格式: { messageType: "USER" | "ASSISTANT", content: "...", metadata: {...}, media: [...] }
    formatHistoryMessages(historyList) {
      // 过滤掉无效消息（错误的消息），只保留有效的消息
      const validMessages = historyList.filter(item => {
        return this.isValidMessage(item)
      })
      
      return validMessages.map(item => {
        // 映射 messageType 到 role
        // messageType: "USER" -> role: "user", "ASSISTANT" -> role: "ai"
        let role = 'ai'
        if (item.messageType === 'USER') {
          role = 'user'
        } else if (item.messageType === 'ASSISTANT') {
          role = 'ai'
        } else if (item.role) {
          // 兼容旧格式
          role = item.role === 'user' ? 'user' : 'ai'
        } else if (item.type === 'user') {
          role = 'user'
        }
        
        // 获取消息ID（从 metadata 中获取）
        const messageId = item.metadata?.id || item.id || item.messageId || item._id
        
        // 获取消息内容（优先使用 content，其次 text）
        const messageText = item.content || item.text || item.message || ''
        
        // 构建消息对象
        const message = {
          id: messageId,
          role: role,
          text: messageText,
          timestamp: item.timestamp || item.createTime || item.createdAt || item.metadata?.timestamp
        }
        
        // 检查是否有媒体（图片）
        if (item.media && Array.isArray(item.media) && item.media.length > 0) {
          // 查找图片类型的媒体
          const imageMedia = item.media.find(m => m.type === 'image' || m.mimeType?.startsWith('image/'))
          if (imageMedia) {
            message.isImage = true
            message.imageUrl = imageMedia.url || imageMedia.src || imageMedia.data || ''
          }
        }
        
        // 兼容旧格式的图片字段
        if (!message.isImage && (item.type === 'image' || item.imageUrl || item.image)) {
          message.isImage = true
          message.imageUrl = item.imageUrl || item.image || item.url || ''
        }
        
        // 如果是文字生图模式
        if (item.tag === '文字生图' || item.mode === 'image') {
          message.tag = '文字生图'
        }
        
        return message
      })
    },
    toggleMode() {
      this.isImageMode = !this.isImageMode
    },
    handleImageError(event, message) {
      console.error('图片加载失败:', message.imageUrl)
      message.text = `图片加载失败，URL: ${message.imageUrl}`
      message.isImage = false
      message.imageUrl = ''
    },
    renderMarkdown(text) {
      try {
        const html = marked(text || '', { breaks: true })
        return DOMPurify.sanitize(html)
      } catch (e) {
        return (text || '').replace(/[&<>]/g, s => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[s]))
      }
    },
    scrollToBottom() {
      this.$nextTick(() => {
        const el = this.$refs.messages
        if (el) el.scrollTop = el.scrollHeight
      })
    },
    async send() {
      // 1. 防止重复调用：如果正在发送或组件已销毁，直接返回
      if (this.isSending || this.isDestroyed) {
        console.warn('[Send] 忽略重复请求：isSending=', this.isSending, 'isDestroyed=', this.isDestroyed)
        return
      }
      
      // 2. 确保上一个请求响应完全结束后才能发起新请求
      if (this.loading) {
        console.warn('[Send] 上一个请求尚未结束，无法发起新请求')
        return
      }
      
      const text = this.input?.trim()
      if (!text) return
      
      // 3. 去重检查：如果正在处理相同的请求，忽略
      if (this.currentRequestText === text) {
        console.warn('[Send] 忽略重复的相同请求:', text)
        return
      }
      
      if (!this.conversantId) {
        alert('缺少用户信息，请重新登录')
        return
      }
      
      // 设置请求锁和当前请求内容
      this.isSending = true
      this.currentRequestText = text
      
      this.messages.push({ role: 'user', text, tag: this.isImageMode ? '文字生图' : null })
      this.input = ''
      this.loading = true
      this.scrollToBottom()
      
      if (this.isImageMode) {
        // 图片生成模式
        this.messages.push({ role: 'ai', text: '', isImage: true })
        this.scrollToBottom()
        try {
          await this.generateImage(text)
        } catch (e) {
          const last = this.messages[this.messages.length - 1]
          if (last && last.role === 'ai') {
            last.text = `图片生成失败：${e.message}`
            last.isImage = false
          } else {
            this.messages.push({ role: 'ai', text: `图片生成失败：${e.message}` })
          }
        } finally {
          this.loading = false
          this.controller = null
          this.isSending = false
          this.currentRequestText = null
          this.scrollToBottom()
        }
      } else {
        // 文字聊天模式
        // 重置打字机效果的状态
        this.pendingText = ''
        this.displayedCharCount = 0
        if (this.typingTimer) {
          clearInterval(this.typingTimer)
          this.typingTimer = null
        }
        this.messages.push({ role: 'ai', text: '' })
        this.scrollToBottom()
        try {
          await this.streamChat(text)
        } catch (e) {
          // 只有在组件未销毁时才更新错误信息
          if (!this.isDestroyed) {
            const last = this.messages[this.messages.length - 1]
            if (last && last.role === 'ai') {
              last.text = last.text || `请求失败：${e.message}`
            } else {
              this.messages.push({ role: 'ai', text: `请求失败：${e.message}` })
            }
          }
        } finally {
          // 无论成功或失败，都要释放锁
          this.loading = false
          this.controller = null
          this.isSending = false
          this.currentRequestText = null
          if (!this.isDestroyed) {
            this.scrollToBottom()
          }
        }
      }
    },
    async streamChat(query) {
      // 使用 @microsoft/fetch-event-source 实现 POST 请求的 SSE 流式输出
      // 参考：https://blog.csdn.net/qq_43962582/article/details/146642100
      // 开发环境下直接访问后端 URL，绕过代理以避免缓冲问题
      const isDev = process.env.NODE_ENV === 'development'
      const apiBase = isDev 
        ? (process.env.VUE_APP_API_BASE || 'http://localhost:10010')  // 开发环境直接访问后端
        : this.apiBase  // 生产环境使用配置的地址
      const token = getToken()
      const url = `${apiBase}/api/simple/chat`
      
      this.controller = new AbortController()
      
      const headers = {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
        'Cache-Control': 'no-cache'
      }
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }
      
      // 保存 this 引用，确保回调中可以访问 Vue 实例
      const vm = this
      
      // 处理接收到的数据块
      const appendChunk = (chunkText) => {
        // 如果组件已销毁，不处理数据
        if (vm.isDestroyed) return
        
        if (chunkText === null || chunkText === undefined) return
        if (chunkText === '') {
          // 空字符串表示换行
          vm.pendingText += '\n'
          vm.ensureTyping()
        } else {
          // 确保 chunkText 是字符串类型
          const text = String(chunkText)
          if (text) {
            vm.pendingText += text
            // 调试：记录累积的文本长度
            console.log('[SSE] 添加文本块:', text.length, '字符, 总长度:', vm.pendingText.length)
            vm.ensureTyping()
          }
        }
      }
      
      // 解析数据内容
      const parseData = (dataStr) => {
        // 处理特殊标记
        if (dataStr === '[DONE]') {
          return
        }
        
        // 空字符串或 null/undefined 表示换行
        if (!dataStr || dataStr === '') {
          appendChunk('')
          return
        }
        
        try {
          const json = JSON.parse(dataStr)
          let delta = ''
          
          // 优先从 results 数组中获取
          if (json.results && Array.isArray(json.results) && json.results.length > 0) {
            for (const resultItem of json.results) {
              if (resultItem.output) {
                const content = resultItem.output.content || resultItem.output.text || ''
                // 确保 content 是字符串类型
                if (content !== null && content !== undefined) {
                  delta += String(content)
                }
              }
            }
          }
          // 如果没有 results，尝试从 result 中获取
          else if (json.result && json.result.output) {
            const content = json.result.output.content || json.result.output.text || ''
            delta = content !== null && content !== undefined ? String(content) : ''
          }
          // 兼容旧格式：直接字段
          else {
            const content = json.delta || json.content || json.text || ''
            delta = content !== null && content !== undefined ? String(content) : ''
          }
          
          // 只有当 delta 不为空时才添加
          if (delta) {
            appendChunk(delta)
          } else if (delta === '') {
            // 空字符串表示换行
            appendChunk('')
          }
        } catch (e) {
          // 如果不是 JSON，直接作为文本处理（可能是纯文本 SSE 事件）
          // 确保是字符串类型
          const text = dataStr ? String(dataStr) : ''
          if (text) {
            appendChunk(text)
          }
        }
      }
      
      return new Promise((resolve, reject) => {
        fetchEventSource(url, {
          method: 'POST',
          headers: headers,
          body: JSON.stringify({
            query: query,
            conversantId: vm.conversantId
          }),
          signal: vm.controller.signal,
          // 处理接收到的消息
          onmessage(msg) {
            // 如果组件已销毁，不处理消息
            if (vm.isDestroyed) return
            
            try {
              // msg.data 包含 SSE 事件的数据
              // 调试：记录原始数据长度
              if (msg.data && msg.data.length > 0) {
                console.log('[SSE] 收到数据长度:', msg.data.length, '预览:', msg.data.substring(0, 50))
              }
              parseData(msg.data)
              // 强制更新视图（仅在组件未销毁时）
              if (!vm.isDestroyed) {
                vm.$forceUpdate()
              }
            } catch (error) {
              console.error('处理消息错误:', error, '原始数据:', msg.data)
            }
          },
          // 处理错误
          onerror(err) {
            // 如果组件已销毁，忽略错误，但确保 Promise 能 resolve
            if (vm.isDestroyed) {
              resolve()
              return
            }
            
            console.error('SSE 连接错误:', err)
            // 如果是因为中断导致的错误，resolve 而不是 reject，确保 loading 状态能被重置
            if (err.name === 'AbortError') {
              resolve()
            } else {
              reject(err)
            }
          },
          // 连接打开时
          onopen(response) {
            if (!response.ok) {
              reject(new Error(`HTTP ${response.status}`))
              return
            }
          },
          // 连接关闭时
          onclose() {
            // 如果组件已销毁，直接完成，不处理剩余数据
            if (vm.isDestroyed) {
              resolve()
              return
            }
            
            // 流结束时，确保所有剩余内容都被显示
            // 使用轮询检查，确保所有内容都显示完
            const checkInterval = 100 // 每 100ms 检查一次
            const maxWaitTime = 10000 // 最多等待 10 秒
            let elapsedTime = 0
            
            const checkAndComplete = () => {
              // 如果组件已销毁，停止检查
              if (vm.isDestroyed) {
                resolve()
                return
              }
              
              if (!vm.pendingText || vm.pendingText.length === 0) {
                // 没有剩余内容，直接完成
                resolve()
                return
              }
              
              // 如果没有定时器在运行，启动它
              if (!vm.typingTimer) {
                vm.ensureTyping()
              }
              
              // 计算剩余未显示的字符
              const allChars = Array.from(vm.pendingText)
              const remainingCount = allChars.length - vm.displayedCharCount
              
              if (remainingCount <= 0) {
                // 所有内容都已显示
                vm.pendingText = ''
                vm.displayedCharCount = 0
                resolve()
                return
              }
              
              elapsedTime += checkInterval
              if (elapsedTime >= maxWaitTime) {
                // 超时了，强制显示所有剩余内容（仅在组件未销毁时）
                if (!vm.isDestroyed && vm.pendingText && vm.pendingText.length > 0) {
                  const remainingChars = allChars.slice(vm.displayedCharCount)
                  if (remainingChars.length > 0) {
                    const last = vm.messages[vm.messages.length - 1]
                    if (last && last.role === 'ai') {
                      last.text += remainingChars.join('')
                    }
                    vm.pendingText = ''
                    vm.displayedCharCount = 0
                    vm.$forceUpdate()
                    vm.scrollToBottom()
                  }
                }
                resolve()
                return
              }
              
              // 继续检查
              setTimeout(checkAndComplete, checkInterval)
            }
            
            // 开始检查
            checkAndComplete()
          }
        }).catch(err => {
          // 如果是因为中断导致的错误，resolve 而不是 reject，确保 loading 状态能被重置
          if (err.name === 'AbortError') {
            resolve()
          } else {
            reject(err)
          }
        })
      })
    },
    async generateImage(query) {
      // 调用图片生成 API
      const url = `/api/simple/image?query=${encodeURIComponent(query)}&conversantId=${encodeURIComponent(this.conversantId)}`
      this.controller = new AbortController()
      const res = await get(url, {
        signal: this.controller.signal
      })
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }
      
      const contentType = res.headers.get('content-type')
      let imageUrl = ''
      
      // 判断返回类型
      if (contentType && contentType.includes('application/json')) {
        // JSON 格式，尝试多个可能的字段
        const data = await res.json()
        console.log('图片生成返回数据:', data)
        imageUrl = data.imageUrl || data.url || data.image || data.data || data.result || data.link || ''
        
        // 如果是嵌套对象，尝试深层获取
        if (!imageUrl && data.data && typeof data.data === 'object') {
          imageUrl = data.data.url || data.data.imageUrl || data.data.image || ''
        }
      } else {
        // 纯文本格式，直接作为 URL
        imageUrl = await res.text()
      }
      
      const last = this.messages[this.messages.length - 1]
      if (last && last.role === 'ai') {
        if (imageUrl && imageUrl.trim()) {
          last.imageUrl = imageUrl.trim()
          console.log('图片 URL:', last.imageUrl)
        } else {
          last.text = '图片生成失败：未返回有效的图片地址'
          last.isImage = false
        }
      }
    },
    ensureTyping() {
      // 如果组件已销毁，不启动打字机效果
      if (this.isDestroyed) return
      
      if (this.typingTimer) {
        // 如果定时器已经在运行，不需要重新启动
        return
      }
      
      this.typingTimer = setInterval(() => {
        // 如果组件已销毁，停止定时器
        if (this.isDestroyed) {
          clearInterval(this.typingTimer)
          this.typingTimer = null
          this.displayedCharCount = 0
          return
        }
        
        // 每次循环都重新读取 pendingText，因为可能已经有新数据追加
        if (!this.pendingText || this.pendingText.length === 0) {
          clearInterval(this.typingTimer)
          this.typingTimer = null
          this.displayedCharCount = 0
          return
        }
        
        // 使用 Array.from 正确处理 Unicode 字符（包括 emoji、代理对等）
        const allChars = Array.from(this.pendingText)
        
        // 如果已经显示的字符数 >= 总字符数，说明已经全部显示完了
        if (this.displayedCharCount >= allChars.length) {
          // 清空 pendingText，因为已经全部显示了
          this.pendingText = ''
          clearInterval(this.typingTimer)
          this.typingTimer = null
          this.displayedCharCount = 0
          return
        }
        
        // 取下一个要显示的字符
        const nextChar = allChars[this.displayedCharCount]
        if (nextChar) {
          this.displayedCharCount++
          
          // 显示这个字符（仅在组件未销毁时）
          if (!this.isDestroyed) {
            const last = this.messages[this.messages.length - 1]
            if (last && last.role === 'ai') {
              last.text += nextChar
              this.scrollToBottom()
            }
          }
        }
      }, this.typingSpeedMs)
    },
    stop() {
      if (this.controller) {
        this.controller.abort()
        this.controller = null
      }
      if (this.typingTimer) {
        clearInterval(this.typingTimer)
        this.typingTimer = null
      }
      
      // 如果还有待显示的文本，立即显示完
      if (this.pendingText && this.pendingText.length > 0) {
        const allChars = Array.from(this.pendingText)
        const remainingChars = allChars.slice(this.displayedCharCount)
        if (remainingChars.length > 0) {
          const last = this.messages[this.messages.length - 1]
          if (last && last.role === 'ai') {
            last.text += remainingChars.join('')
          }
        }
      }
      
      this.pendingText = ''
      this.displayedCharCount = 0
      this.loading = false
      // 释放请求锁
      this.isSending = false
      this.currentRequestText = null
      
      if (!this.isDestroyed) {
        this.scrollToBottom()
      }
    },
    copyText(text) {
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text || '')
        } else {
          const el = document.createElement('textarea')
          el.value = text || ''
          document.body.appendChild(el)
          el.select()
          document.execCommand('copy')
          document.body.removeChild(el)
        }
        // 轻量提示
        console.log('已复制')
      } catch (e) {
        console.warn('复制失败', e)
      }
    },
    async handleLogout() {
      try {
        // 调用登出接口
        await logout()
        // logout 函数内部已经调用了 clearAuth，清除本地认证信息
      } catch (error) {
        console.error('登出接口调用失败:', error)
        // 即使登出接口失败，也清除本地认证信息
        clearAuth()
      }
      // 无论接口是否成功，都跳转到登录页面
      this.$router.replace({ name: 'Login' })
    }
  }
}
</script>

<style scoped>
.chat-wrap {
  min-height: 100vh;
  height: 100vh;
  background: #f5f7fb;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.topbar {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  background: linear-gradient(180deg, #7c6cff, #6f6bff 40%, #6b63ff 100%);
  color: #fff;
}
.brand { font-weight: 700; }
.icon-btn {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  border: none;
  background: rgba(255,255,255,0.2);
  color: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s ease;
}
.icon-btn:hover {
  background: rgba(255,255,255,0.3);
}
.icon-btn:active {
  background: rgba(255,255,255,0.25);
}
.logout-icon {
  width: 20px;
  height: 20px;
}
.messages {
  flex: 1;
  padding: 14px 12px 20px;
  overflow-y: auto; /* 仅允许消息区垂直滚动 */
  overflow-x: hidden;
  overscroll-behavior: contain; /* 阻止滚动冒泡导致页面层级回弹 */
  -webkit-overflow-scrolling: touch;
}
.loading-tip,
.loading-more {
  text-align: center;
  padding: 16px;
  color: #9ca3af;
  font-size: 14px;
}
.loading-more {
  padding: 12px;
  color: #6b7280;
  font-size: 13px;
}
.message {
  display: flex;
  gap: 10px;
  margin: 10px 0;
  align-items: flex-start;
}
.message.user { flex-direction: row-reverse; }
.avatar {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: #fff;
  background: #7c6cff;
}
.message.user .avatar { background: #7c6cff; }
.content { 
  max-width: 78%;
}
.bubble {
  padding: 10px 12px;
  border-radius: 16px;
  line-height: 1.6;
  word-break: break-all; /* 允许在任意位置换行，确保长文本不截断 */
}
.user-bubble {
  color: #fff;
  background: #7c6cff;
}
.chip {
  display: inline-block;
  margin-right: 6px;
  padding: 2px 8px;
  font-size: 12px;
  border-radius: 999px;
  background: rgba(255,255,255,0.25);
}
.ai-card {
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 6px 18px rgba(0,0,0,0.08);
  border: 1px solid #eef0f5;
}
.ai-card .markdown { 
  color: #1f2937; 
  padding: 12px;
  word-break: break-all; /* 允许在任意位置换行，确保长文本不截断 */
}
.image-container {
  padding: 12px;
  position: relative;
}
.generated-image {
  max-width: 100%;
  width: 100%;
  height: auto;
  border-radius: 12px;
  display: block;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  background: #f9fafb;
  animation: fadeIn 0.3s ease-in;
}
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
.toolrow { display: flex; gap: 12px; padding: 8px 12px 12px; }
.tool { border: none; background: #f2f3f8; border-radius: 10px; padding: 6px 10px; }
.bubble.markdown :deep(pre),
.bubble.markdown pre {
  background: rgba(0,0,0,0.35);
  border: 1px solid rgba(255,255,255,0.08);
  padding: 10px;
  border-radius: 10px;
  overflow-x: auto;
}
.bubble.markdown :deep(code),
.bubble.markdown code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  background: rgba(0,0,0,0.25);
  padding: 2px 6px;
  border-radius: 6px;
}
.bubble.markdown :deep(h1),
.bubble.markdown :deep(h2),
.bubble.markdown :deep(h3) {
  margin: 8px 0 6px;
}
.bubble.markdown :deep(ul),
.bubble.markdown :deep(ol) {
  padding-left: 20px;
}
.composer {
  position: sticky;
  bottom: 0;
  padding: 16px;
  background: linear-gradient(to top, #f5f7fb 60%, rgba(245,247,251,0.9) 80%, transparent);
  z-index: 20;
}
.composer-card {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
  background: #fff;
  border-radius: 20px;
  box-shadow: 0 4px 24px rgba(0,0,0,0.12);
  border: 1px solid #e5e7eb;
}
.input-container {
  margin-bottom: 12px;
}
.main-input {
  width: 100%;
  height: 56px;
  padding: 0 16px;
  border-radius: 14px;
  border: 1px solid #e5e7eb;
  background: #fff;
  color: #111827;
  font-size: 15px;
  box-sizing: border-box;
  transition: all 0.2s ease;
  outline: none;
  margin-bottom: 12px;
}
.main-input:focus {
  border-color: #7c6cff;
  box-shadow: 0 0 0 3px rgba(124, 108, 255, 0.1);
}
.main-input::placeholder {
  color: #9ca3af;
}
.main-input:disabled {
  background: #f9fafb;
  cursor: not-allowed;
}
.input-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}
.mode-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 38px;
  padding: 0 16px;
  border-radius: 20px;
  border: 1px solid #e5e7eb;
  background: #fff;
  color: #374151;
  font-size: 14px;
  cursor: pointer;
  white-space: nowrap;
}
.mode-btn .icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}
.mode-btn.active {
  background: #3b82f6;
  color: #fff;
  border-color: #3b82f6;
}
.mode-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.send-btn {
  width: 40px;
  height: 40px;
  min-width: 40px;
  border-radius: 50%;
  border: none;
  background: linear-gradient(135deg, #7c6cff, #6f6bff);
  color: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-left: auto;
  box-shadow: 0 2px 8px rgba(124, 108, 255, 0.3);
}
.send-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.send-icon {
  width: 20px;
  height: 20px;
}
.disclaimer {
  text-align: center;
  font-size: 12px;
  color: #9ca3af;
  margin: 0;
  padding-top: 4px;
}
</style>


