<template>
  <div class="auth-page">
    <div class="auth-card">
      <div class="auth-header">
        <div class="auth-icon">🚀</div>
        <h2>Создать аккаунт</h2>
        <p>Присоединяйтесь к криптоаукционам</p>
      </div>
      
      <form @submit.prevent="handleRegister" class="auth-form">
        <div class="form-group">
          <label>Имя пользователя</label>
          <div class="input-wrapper">
            <span class="input-icon">👤</span>
            <input 
              v-model="username" 
              type="text" 
              placeholder="Придумайте имя пользователя"
              required 
            />
          </div>
          <small>Минимум 3 символа, буквы, цифры и _ @ . -</small>
        </div>
        
        <div class="form-group">
          <label>Пароль</label>
          <div class="input-wrapper">
            <span class="input-icon">🔒</span>
            <input 
              v-model="password" 
              :type="showPassword ? 'text' : 'password'" 
              placeholder="Придумайте пароль"
              required 
            />
            <button type="button" class="toggle-password" @click="showPassword = !showPassword">
              {{ showPassword ? '👁️' : '👁️‍🗨️' }}
            </button>
          </div>
          <small>Минимум 6 символов</small>
        </div>
        
        <div v-if="error" class="alert alert-error">
          <span>⚠️</span> {{ error }}
        </div>
        
        <div v-if="success" class="alert alert-success">
          <span>✅</span> Регистрация успешна! Перенаправление...
        </div>
        
        <button type="submit" class="btn btn-primary btn-full" :disabled="loading">
          <span v-if="loading" class="spinner-small"></span>
          {{ loading ? 'Регистрация...' : 'Создать аккаунт' }}
        </button>
      </form>

      <!-- Telegram Login Widget -->
      <div v-if="telegramBotUsername" class="telegram-login-section">
        <div class="divider">
          <span>или войти через</span>
        </div>
        <div class="telegram-widget-container" ref="telegramContainer"></div>
      </div>
      
      <div class="auth-footer">
        <p>Уже есть аккаунт? <router-link to="/login">Войти</router-link></p>
      </div>
      
      <div class="auth-terms">
        Регистрируясь, вы соглашаетесь с условиями использования платформы
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import api from '../api'

const router = useRouter()
const authStore = useAuthStore()

const username = ref('')
const password = ref('')
const error = ref('')
const success = ref(false)
const loading = ref(false)
const showPassword = ref(false)
const telegramBotUsername = ref('')
const telegramContainer = ref(null)

const handleRegister = async () => {
  error.value = ''
  success.value = false
  loading.value = true
  
  const result = await authStore.register(username.value, password.value)
  
  if (result.success) {
    success.value = true
    setTimeout(() => {
      router.push('/auctions')
    }, 1000)
  } else {
    error.value = result.error
  }
  
  loading.value = false
}

const handleTelegramAuth = async (user) => {
  error.value = ''
  loading.value = true
  
  const result = await authStore.telegramAuth(user)
  
  if (result.success) {
    router.push('/auctions')
  } else {
    error.value = result.error
  }
  
  loading.value = false
}

const loadTelegramWidget = async () => {
  try {
    const { data } = await api.get('/config')
    if (data.telegramBotUsername) {
      telegramBotUsername.value = data.telegramBotUsername
      
      await nextTick()
      
      // Регистрируем глобальный callback
      window.onTelegramAuth = handleTelegramAuth
      
      // Создаём скрипт виджета
      const script = document.createElement('script')
      script.async = true
      script.src = 'https://telegram.org/js/telegram-widget.js?22'
      script.setAttribute('data-telegram-login', data.telegramBotUsername)
      script.setAttribute('data-size', 'large')
      script.setAttribute('data-radius', '8')
      script.setAttribute('data-onauth', 'onTelegramAuth(user)')
      script.setAttribute('data-request-access', 'write')
      
      if (telegramContainer.value) {
        telegramContainer.value.appendChild(script)
      }
    }
  } catch (err) {
    console.error('Failed to load Telegram config:', err)
  }
}

onMounted(() => {
  loadTelegramWidget()
})
</script>

<style scoped>
.auth-page {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: calc(100vh - 300px);
  padding: 40px 20px;
}

.auth-card {
  width: 100%;
  max-width: 420px;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 20px;
  padding: 40px;
  position: relative;
  overflow: hidden;
}

.auth-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: var(--gradient-primary);
}

.auth-header {
  text-align: center;
  margin-bottom: 32px;
}

.auth-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.auth-header h2 {
  font-size: 24px;
  font-weight: 700;
  margin-bottom: 8px;
  color: var(--text-primary);
}

.auth-header p {
  color: var(--text-secondary);
  font-size: 14px;
}

.auth-form {
  margin-bottom: 24px;
}

.input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.input-icon {
  position: absolute;
  left: 16px;
  font-size: 16px;
  z-index: 1;
}

.input-wrapper input {
  padding-left: 48px !important;
  padding-right: 48px !important;
}

.toggle-password {
  position: absolute;
  right: 12px;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 16px;
  padding: 4px;
  opacity: 0.6;
  transition: opacity 0.2s;
}

.toggle-password:hover {
  opacity: 1;
}

.btn-full {
  width: 100%;
  padding: 14px 24px;
  font-size: 16px;
}

.spinner-small {
  width: 18px;
  height: 18px;
  border: 2px solid rgba(0, 0, 0, 0.2);
  border-top-color: currentColor;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-right: 8px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.telegram-login-section {
  margin-bottom: 24px;
}

.divider {
  display: flex;
  align-items: center;
  margin: 24px 0;
  color: var(--text-secondary);
  font-size: 14px;
}

.divider::before,
.divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--border-color);
}

.divider span {
  padding: 0 16px;
}

.telegram-widget-container {
  display: flex;
  justify-content: center;
  min-height: 40px;
}

.auth-footer {
  text-align: center;
  color: var(--text-secondary);
  font-size: 14px;
  margin-bottom: 16px;
}

.auth-footer a {
  color: var(--accent-cyan);
  font-weight: 500;
}

.auth-terms {
  text-align: center;
  font-size: 11px;
  color: var(--text-muted);
  line-height: 1.5;
}
</style>
