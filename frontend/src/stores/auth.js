import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '../api'

export const useAuthStore = defineStore('auth', () => {
  const token = ref(localStorage.getItem('token'))
  const user = ref(null)

  const isAuthenticated = computed(() => !!token.value)

  async function login(username, password) {
    try {
      const response = await api.post('/login', { username, password })
      token.value = response.data.token
      user.value = response.data.user
      localStorage.setItem('token', token.value)
      api.defaults.headers.common['Authorization'] = `Bearer ${token.value}`
      // Загружаем полный профиль с балансами
      await fetchProfile()
      return { success: true }
    } catch (error) {
      return { success: false, error: error.response?.data?.error || 'Ошибка входа' }
    }
  }

  async function register(username, password) {
    try {
      const response = await api.post('/register', { username, password })
      token.value = response.data.token
      user.value = response.data.user
      localStorage.setItem('token', token.value)
      api.defaults.headers.common['Authorization'] = `Bearer ${token.value}`
      // Загружаем полный профиль с балансами
      await fetchProfile()
      return { success: true }
    } catch (error) {
      return { success: false, error: error.response?.data?.error || 'Ошибка регистрации' }
    }
  }

  async function telegramAuth(telegramUser) {
    try {
      const response = await api.post('/telegramAuth', telegramUser)
      token.value = response.data.token
      user.value = response.data.user
      localStorage.setItem('token', token.value)
      api.defaults.headers.common['Authorization'] = `Bearer ${token.value}`
      // Загружаем полный профиль с балансами
      await fetchProfile()
      return { success: true }
    } catch (error) {
      return { success: false, error: error.response?.data?.error || 'Ошибка авторизации через Telegram' }
    }
  }

  async function fetchProfile() {
    try {
      const response = await api.get('/profile')
      user.value = response.data
      return { success: true }
    } catch (error) {
      return { success: false, error: error.response?.data?.error || 'Ошибка загрузки профиля' }
    }
  }

  function logout() {
    token.value = null
    user.value = null
    localStorage.removeItem('token')
    delete api.defaults.headers.common['Authorization']
  }

  // Инициализация при загрузке
  if (token.value) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token.value}`
    fetchProfile()
  }

  return {
    token,
    user,
    isAuthenticated,
    login,
    register,
    telegramAuth,
    fetchProfile,
    logout
  }
})
