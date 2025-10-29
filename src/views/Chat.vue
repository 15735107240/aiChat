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
            <div class="markdown" v-html="renderMarkdown(m.text)"></div>
          </div>
        </div>
      </div>
    </main>

    <form class="composer" @submit.prevent="send">
      <input
        v-model.trim="input"
        type="text"
        placeholder="发送消息..."
        :disabled="loading"
      />
      <button type="submit" :disabled="loading || !input">{{ loading ? '生成中...' : '发送' }}</button>
      <button type="button" class="ghost" @click="stop" :disabled="!loading">停止</button>
    </form>
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
      this.messages.push({ role: 'user', text })
      this.input = ''
      this.loading = true
      this.scrollToBottom()
      // 预先放入一条 AI 消息占位，用于流式拼接
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
    },
    async streamChat(query) {
      // 使用 fetch + ReadableStream 解析 SSE
      const API_BASE = process.env.VUE_APP_API_BASE || 'http://8.148.185.212/apifox'
      const url = `${API_BASE}/api/simple/chat?query=${encodeURIComponent(query)}&conversantId=${encodeURIComponent(this.conversantId)}`
      this.controller = new AbortController()
      const res = await fetch(url, {
        method: 'GET',
        headers: { 'Accept': 'text/event-stream' },
        mode: 'cors',
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
  padding: 14px 12px calc(120px + env(safe-area-inset-bottom));
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
  padding: 10px 12px calc(14px + env(safe-area-inset-bottom));
  background: linear-gradient(to top, rgba(245,247,251,0.98) 70%, rgba(245,247,251,0.85));
  z-index: 20;
}
.composer input {
  width: 100%;
  height: 46px;
  padding: 0 12px;
  border-radius: 12px;
  border: 1px solid #e5e7f0;
  background: #fff;
  color: #111827;
  box-sizing: border-box;
}
.composer form { display: contents; }
.composer button {
  margin-top: 10px;
  width: 100%;
  height: 44px;
  border: none;
  border-radius: 12px;
  background: linear-gradient(135deg, #7c6cff, #6f6bff);
  color: #fff;
  font-weight: 700;
}
.composer button.ghost {
  margin-top: 8px;
  background: #f2f3f8;
  color: #4b5563;
  border: 1px solid #e5e7f0;
}
</style>


