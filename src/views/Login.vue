<template>
  <div class="login-wrap">
    <div class="brand">
      <div class="title">AI+</div>
      <div class="subtitle">手机号验证后开始对话</div>
    </div>
    <div class="card">
      <form @submit.prevent="onSubmit">
        <div class="field">
          <label for="phone">手机号</label>
          <input
            id="phone"
            v-model.trim="phone"
            type="tel"
            inputmode="numeric"
            placeholder="请输入手机号"
            maxlength="20"
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
              required
            />
            <button type="button" class="ghost" @click="sendCode" :disabled="sending">{{ sendText }}</button>
          </div>
        </div>
        <button type="submit" class="primary">开始对话</button>
      </form>
    </div>
  </div>
  </template>

<script>
export default {
  name: 'LoginPage',
  data() {
    return {
      phone: '',
      code: '',
      sending: false,
      countdown: 0
    }
  },
  computed: {
    sendText() {
      return this.countdown > 0 ? `${this.countdown}s` : '发送验证码'
    }
  },
  methods: {
    sendCode() {
      if (!this.phone) {
        alert('请输入手机号')
        return
      }
      alert('因为开发者太穷发不起短信，随便输入六位数字好了')
      this.sending = true
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
    },
    onSubmit() {
      if (!this.phone) {
        alert('请输入手机号')
        return
      }
      if (!/^\d{6}$/.test(this.code)) {
        alert('请输入6位数字验证码（随便6位即可）')
        return
      }
      this.$router.push({
        name: 'Chat',
        query: { conversantId: this.phone }
      })
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
</style>


