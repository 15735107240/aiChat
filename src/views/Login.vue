<template>
  <div class="login-wrap">
    <div class="brand">
      <div class="title">AI+</div>
      <div class="subtitle">手机号验证后开始对话</div>
    </div>
    <div class="card">
      <form @submit.prevent="onSubmit">
        <div v-if="errorMessage" class="error-message">{{ errorMessage }}</div>
        <div class="field">
          <label for="phone">手机号</label>
          <input
            id="phone"
            v-model.trim="phone"
            type="tel"
            inputmode="numeric"
            placeholder="请输入手机号"
            maxlength="11"
            :disabled="loading"
            required
          />
        </div>
        <div class="field has-action">
          <label for="code">验证码</label>
          <div class="row">
            <input
              id="code"
              v-model.trim="code"
              type="text"
              inputmode="numeric"
              placeholder="请输入6位验证码"
              maxlength="6"
              :disabled="loading"
              required
            />
            <button type="button" class="ghost" @click="sendCode" :disabled="sending || loading">{{ sendText }}</button>
          </div>
        </div>
        <button type="submit" class="primary" :disabled="loading">
          {{ loading ? '登录中...' : '开始对话' }}
        </button>
      </form>
    </div>
  </div>
</template>

<script>
import { getAuthCode, login, getCurrentUser } from '@/utils/api'

export default {
  name: 'LoginPage',
  data() {
    return {
      phone: '',
      code: '',
      sending: false,
      countdown: 0,
      loading: false,
      errorMessage: ''
    }
  },
  computed: {
    sendText() {
      return this.countdown > 0 ? `${this.countdown}s` : '发送验证码'
    }
  },
  methods: {
    async sendCode() {
      if (!this.phone) {
        this.errorMessage = '请输入手机号'
        return
      }
      
      // 验证手机号格式（11位数字，1开头）
      if (!/^1\d{10}$/.test(this.phone)) {
        this.errorMessage = '请输入正确的手机号格式（11位数字，1开头）'
        return
      }
      
      this.errorMessage = ''
      this.sending = true
      
      try {
        // 调用获取验证码接口
        const data = await getAuthCode(this.phone)
        
        // 如果接口返回了验证码（开发环境），自动回显到输入框
        if (data.code) {
          this.code = data.code
        }
        
        // 显示提示信息
        if (data.message) {
          this.errorMessage = data.message
          // 如果是成功消息，3秒后清除
          if (data.success) {
            setTimeout(() => {
              this.errorMessage = ''
            }, 3000)
          }
        }
        
        // 开始倒计时
        this.countdown = 60
        const tick = () => {
          if (this.countdown <= 0) {
            this.sending = false
            return
          }
          this.countdown -= 1
          setTimeout(tick, 1000)
        }
        setTimeout(tick, 1000)
      } catch (error) {
        console.error('获取验证码失败:', error)
        this.errorMessage = error.message || '获取验证码失败，请重试'
        this.sending = false
      }
    },
    async onSubmit() {
      if (!this.phone) {
        this.errorMessage = '请输入手机号'
        return
      }
      
      // 验证手机号格式
      if (!/^1\d{10}$/.test(this.phone)) {
        this.errorMessage = '请输入正确的手机号格式（11位数字，1开头）'
        return
      }
      
      if (!/^\d{6}$/.test(this.code)) {
        this.errorMessage = '请输入6位数字验证码'
        return
      }
      
      this.errorMessage = ''
      this.loading = true
      
      try {
        // 1. 调用登录接口获取 accessToken
        await login(this.phone, this.code)
        
        // 2. 获取当前用户信息（包含 username）
        await getCurrentUser()
        
        // 3. 跳转到聊天页面（不需要传递 conversantId，从用户信息中获取）
        const redirect = this.$route.query.redirect
        if (redirect) {
          this.$router.push(redirect)
        } else {
          this.$router.push({ name: 'Chat' })
        }
      } catch (error) {
        console.error('登录失败:', error)
        this.errorMessage = error.message || '登录失败，请检查验证码是否正确'
      } finally {
        this.loading = false
      }
    }
  }
}
</script>

<style scoped>
.login-wrap {
  min-height: 100vh;
  height: 100vh; /* 固定视口高度，避免页面滚动 */
  padding: 24px 16px 32px;
  background: #f5f7fb;
  display: flex;
  flex-direction: column;
  align-items: center;
  overflow: hidden; /* 禁止内部页面级滚动 */
}
.brand {
  margin-top: 8vh;
  text-align: center;
  color: #111827;
}
.title { font-size: 22px; font-weight: 700; }
.subtitle { font-size: 13px; color: #6b7280; margin-top: 4px; }
.card {
  width: 100%;
  max-width: 460px;
  margin-top: 24px;
  padding: 20px 16px;
  background: #fff;
  border: 1px solid #eef0f5;
  border-radius: 14px;
  box-shadow: 0 6px 18px rgba(0,0,0,0.08);
}
.field {
  display: flex;
  flex-direction: column;
  margin-bottom: 14px;
}
.field label {
  color: #374151;
  margin-bottom: 6px;
  font-size: 13px;
}
.field input {
  height: 42px;
  padding: 0 12px;
  border-radius: 10px;
  background: #fff;
  border: 1px solid #e5e7f0;
  color: #111827;
  outline: none;
}
.field input::placeholder { color: #9ca3af; }
.has-action .row {
  display: flex;
  gap: 10px;
}
button.primary {
  width: 100%;
  height: 44px;
  border: none;
  border-radius: 12px;
  background: linear-gradient(135deg, #7c6cff, #6f6bff);
  color: #fff;
  font-weight: 700;
  cursor: pointer;
}
button.ghost {
  height: 42px;
  padding: 0 14px;
  border-radius: 10px;
  border: 1px solid #e5e7f0;
  background: #f2f3f8;
  color: #4b5563;
  cursor: pointer;
}
button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.tip {
  margin-top: 10px;
  color: #9aa3b2;
  font-size: 12px;
  line-height: 1.6;
}
.error-message {
  margin-bottom: 14px;
  padding: 10px 12px;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 8px;
  color: #dc2626;
  font-size: 13px;
  text-align: center;
}
</style>


