<template>
  <div class="chat-wrap">
    <header class="topbar">
      <button class="icon-btn" @click="$router.replace({ name: 'Login' })">☰</button>
      <div class="brand">AI+</div>
      <div class="spacer"></div>
    </header>

    <main class="messages" ref="messages">
      <div v-for="(m, i) in messages" :key="i" class="message" :class="m.role">
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
      messages: [
        { role: 'ai', text: '你好，我是 AI，有什么想聊的吗？' }
      ]
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
    }
  },
  mounted() {
    this.scrollToBottom()
  },
  methods: {
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
        if (!chunkText) return
        this.pendingText += chunkText
        this.ensureTyping()
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
            const trimmed = line.trim()
            if (!trimmed) continue
            if (trimmed.startsWith('data:')) {
              const dataStr = trimmed.slice(5).trim()
              if (dataStr === '[DONE]') {
                return
              }
              try {
                const json = JSON.parse(dataStr)
                const delta = json.delta || json.content || json.text || ''
                if (delta) appendChunk(delta)
              } catch (_) {
                appendChunk(dataStr)
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
          const delta = j.delta || j.content || j.text || ''
          if (delta) this.pendingText += delta
        } catch (_) {
          this.pendingText += maybe
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
        const nextChar = this.pendingText[0]
        this.pendingText = this.pendingText.slice(1)
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
.content { max-width: 78%; }
.bubble {
  padding: 10px 12px;
  border-radius: 16px;
  line-height: 1.6;
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
.ai-card .markdown { color: #1f2937; padding: 12px; }
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


