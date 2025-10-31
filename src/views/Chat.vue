<template>
  <div class="chat-wrap">
    <header class="topbar">
      <button class="icon-btn" @click="$router.replace({ name: 'Login' })">☰</button>
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
              :disabled="!input"
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
      messages: [],
      // 历史记录分页（分页从1开始）
      historyPage: 1,
      historySize: 10,
      hasMoreHistory: true,
      loadingHistory: false,
      scrollTimer: null
    }
  },
  computed: {
    // 统一的 API 基础地址配置
    apiBase() {
      // 开发环境使用相对路径（通过代理），生产环境使用环境变量配置的完整地址
      const isDev = process.env.NODE_ENV === 'development'
      return isDev ? '' : process.env.VUE_APP_API_BASE
    },
    conversantId() {
      return this.$route.query.conversantId || ''
    },
    conversantIdDisplay() {
      return this.conversantId ? `用户：${this.conversantId}` : '未提供手机号'
    },
    // 获取当前登录的用户ID，用于历史记录接口
    // 优先使用路由参数中的conversantId（手机号），如果没有则使用默认值
    username() {
      // 优先使用路由参数中的用户ID（登录时传入的手机号）
      if (this.conversantId) {
        return this.conversantId
      }
      // 如果没有，尝试从localStorage获取
      const savedUserId = localStorage.getItem('userId')
      if (savedUserId) {
        return savedUserId
      }
      // 最后使用默认值（开发测试用）
      return 'yanwenjie'
    }
  },
  mounted() {
    this.loadHistory()
  },
  beforeDestroy() {
    // 清理定时器
    if (this.scrollTimer) {
      clearTimeout(this.scrollTimer)
    }
    if (this.typingTimer) {
      clearInterval(this.typingTimer)
    }
    if (this.controller) {
      this.controller.abort()
    }
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
        const url = `${this.apiBase}/api/history/${this.username}/page?page=${this.historyPage}&size=${this.historySize}`
        const res = await fetch(url, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        })
        
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
      const text = this.input
      if (!text) return
      if (!this.conversantId) {
        alert('缺少 conversantId（手机号）')
        return
      }
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
          this.scrollToBottom()
        }
      } else {
        // 文字聊天模式
        this.messages.push({ role: 'ai', text: '' })
        this.scrollToBottom()
        try {
          await this.streamChat(text)
        } catch (e) {
          const last = this.messages[this.messages.length - 1]
          if (last && last.role === 'ai') {
            last.text = last.text || `请求失败：${e.message}`
          } else {
            this.messages.push({ role: 'ai', text: `请求失败：${e.message}` })
          }
        } finally {
          this.loading = false
          this.controller = null
          this.scrollToBottom()
        }
      }
    },
    async streamChat(query) {
      // 使用 fetch + ReadableStream 解析 SSE
      const url = `${this.apiBase}/api/simple/chat?query=${encodeURIComponent(query)}&conversantId=${encodeURIComponent(this.conversantId)}`
      this.controller = new AbortController()
      const res = await fetch(url, {
        method: 'GET',
        headers: { 'Accept': 'text/event-stream' },
        signal: this.controller.signal
      })
      if (!res.ok || !res.body) {
        throw new Error(`HTTP ${res.status}`)
      }
      const reader = res.body.getReader()
      const decoder = new TextDecoder('utf-8')
      let buffer = ''
      const appendChunk = (chunkText) => {
        // 如果 chunkText 为空字符串或 null/undefined，表示换行
        // null/undefined 表示没有数据，空字符串表示换行
        if (chunkText === null || chunkText === undefined) return
        // 空字符串表示换行，需要添加 \n
        if (chunkText === '') {
          this.pendingText += '\n'
          this.ensureTyping()
        } else {
          this.pendingText += chunkText
          this.ensureTyping()
        }
      }
      let isDone = false
      while (!isDone) {
        const { done, value } = await reader.read()
        isDone = done
        if (isDone) break
        buffer += decoder.decode(value, { stream: true })
        // 逐行解析 SSE（以\n\n分割事件）
        let idx
        while ((idx = buffer.indexOf('\n\n')) !== -1) {
          const rawEvent = buffer.slice(0, idx)
          buffer = buffer.slice(idx + 2)
          const lines = rawEvent.split('\n')
          for (const line of lines) {
            // 检查是否是 data: 开头的行（即使后面为空）
            if (line.startsWith('data:')) {
              // 提取 data: 后面的内容
              const colonIndex = line.indexOf(':')
              let dataStr = ''
              if (colonIndex !== -1) {
                dataStr = line.slice(colonIndex + 1).trim()
              }
              
              if (dataStr === '[DONE]') {
                return
              }
              
              // 如果 dataStr 为空字符串，表示换行
              if (dataStr === '') {
                appendChunk('')
              } else {
                try {
                  const json = JSON.parse(dataStr)
                  // 新接口格式：从 results[].output.content 或 result.output.content 中获取内容
                  let delta = ''
                  
                  // 优先从 results 数组中获取
                  if (json.results && Array.isArray(json.results) && json.results.length > 0) {
                    // 遍历 results 数组，提取所有 output.content
                    for (const resultItem of json.results) {
                      if (resultItem.output) {
                        const content = resultItem.output.content || resultItem.output.text || ''
                        if (content !== null && content !== undefined) {
                          delta += content
                        }
                      }
                    }
                  }
                  // 如果没有 results，尝试从 result 中获取
                  else if (json.result && json.result.output) {
                    delta = json.result.output.content || json.result.output.text || ''
                  }
                  // 兼容旧格式：直接字段
                  else {
                    delta = json.delta || json.content || json.text || ''
                  }
                  
                  // delta 为空字符串 '' 表示换行
                  // delta 为 null 或 undefined 表示无数据，忽略
                  if (delta !== null && delta !== undefined && delta !== '') {
                    appendChunk(delta)
                  } else if (delta === '') {
                    // 空字符串表示换行
                    appendChunk('')
                  }
                } catch (_) {
                  // 如果不是 JSON，直接作为文本处理
                  appendChunk(dataStr)
                }
              }
            }
          }
        }
      }
      const rest = buffer.trim()
      if (rest) {
        const maybe = rest.replace(/^data:\s*/g, '')
        try {
          const j = JSON.parse(maybe)
          // 新接口格式：从 results[].output.content 或 result.output.content 中获取内容
          let delta = ''
          
          // 优先从 results 数组中获取
          if (j.results && Array.isArray(j.results) && j.results.length > 0) {
            // 遍历 results 数组，提取所有 output.content
            for (const resultItem of j.results) {
              if (resultItem.output) {
                const content = resultItem.output.content || resultItem.output.text || ''
                if (content !== null && content !== undefined) {
                  delta += content
                }
              }
            }
          }
          // 如果没有 results，尝试从 result 中获取
          else if (j.result && j.result.output) {
            delta = j.result.output.content || j.result.output.text || ''
          }
          // 兼容旧格式：直接字段
          else {
            delta = j.delta || j.content || j.text || ''
          }
          
          if (delta !== null && delta !== undefined && delta !== '') {
            this.pendingText += delta
          } else if (delta === '') {
            // 空字符串表示换行
            this.pendingText += '\n'
          }
        } catch (_) {
          // 如果 maybe 为空，表示换行
          if (maybe === '') {
            this.pendingText += '\n'
          } else {
            this.pendingText += maybe
          }
        }
      }
      // 尝试继续把剩余 pendingText 打印完
      this.ensureTyping()
    },
    async generateImage(query) {
      // 调用图片生成 API
      const url = `${this.apiBase}/api/simple/image?query=${encodeURIComponent(query)}&conversantId=${encodeURIComponent(this.conversantId)}`
      this.controller = new AbortController()
      const res = await fetch(url, {
        method: 'GET',
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
      if (this.typingTimer) return
      this.typingTimer = setInterval(() => {
        if (!this.pendingText || this.pendingText.length === 0) {
          clearInterval(this.typingTimer)
          this.typingTimer = null
          return
        }
        // 正确处理 Unicode 字符：使用字符串的字符迭代器
        // 这样可以正确处理所有字符，包括中文、emoji、代理对等
        let nextChar = ''
        let charLength = 1
        
        // 检查是否是代理对（surrogate pair）
        const firstCode = this.pendingText.charCodeAt(0)
        if (firstCode >= 0xD800 && firstCode <= 0xDBFF) {
          // 高代理，需要两个字符
          const secondCode = this.pendingText.charCodeAt(1)
          if (secondCode >= 0xDC00 && secondCode <= 0xDFFF) {
            // 有效的代理对
            nextChar = this.pendingText.substring(0, 2)
            charLength = 2
          } else {
            // 无效的代理对，只取一个字符
            nextChar = this.pendingText[0]
            charLength = 1
          }
        } else {
          // 普通字符或低代理（单独出现）
          nextChar = this.pendingText[0]
          charLength = 1
        }
        
        this.pendingText = this.pendingText.slice(charLength)
        
        const last = this.messages[this.messages.length - 1]
        if (last && last.role === 'ai') {
          last.text += nextChar
        }
        this.scrollToBottom()
      }, this.typingSpeedMs)
    },
    stop() {
      if (this.controller) {
        this.controller.abort()
      }
      if (this.typingTimer) {
        clearInterval(this.typingTimer)
        this.typingTimer = null
      }
      this.pendingText = ''
      this.loading = false
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


