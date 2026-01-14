<template>
  <div class="auctions-page">
    <div class="page-header">
      <div class="header-content">
        <h1>🎯 Аукционы</h1>
        <p class="page-description">Выберите аукцион и начните торговать</p>
      </div>
      <router-link v-if="authStore.user?.role === 'admin'" to="/admin" class="btn btn-primary">
        <span>➕</span> Создать аукцион
      </router-link>
    </div>

    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <p>Загрузка аукционов...</p>
    </div>
    
    <div v-else-if="error" class="alert alert-error">
      <span>⚠️</span> {{ error }}
    </div>
    
    <div v-else-if="auctions.length === 0" class="empty-state">
      <div class="empty-icon">📭</div>
      <h3>Нет активных аукционов</h3>
      <p>Аукционы появятся здесь, когда администратор их создаст</p>
    </div>
    
    <div v-else class="auctions-grid">
      <div v-for="auction in auctions" :key="auction.id" class="auction-card">
        <div class="card-header">
          <span class="badge" :class="getStatusBadgeClass(auction.status)">
            {{ getStatusText(auction.status) }}
          </span>
          <span class="currency-badge">{{ auction.currency }}</span>
        </div>
        
        <h3 class="auction-title">{{ auction.title }}</h3>
        <p class="auction-description">{{ auction.description }}</p>
        
        <div class="auction-stats">
          <div class="stat">
            <span class="stat-icon">🔄</span>
            <div class="stat-info">
              <span class="stat-value">{{ auction.currentRound }} / {{ auction.totalRounds }}</span>
              <span class="stat-label">Раунд</span>
            </div>
          </div>
          <div class="stat">
            <span class="stat-icon">📦</span>
            <div class="stat-info">
              <span class="stat-value">{{ auction.itemsSold }} / {{ auction.totalItems }}</span>
              <span class="stat-label">Лотов</span>
            </div>
          </div>
        </div>
        
        <router-link :to="`/auctions/${auction.id}`" class="btn btn-primary btn-full mt-2">
          <span>📊</span> Подробнее
        </router-link>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import api from '../api'
import { useAuthStore } from '../stores/auth'

const authStore = useAuthStore()
const auctions = ref([])
const loading = ref(true)
const error = ref('')
let interval = null

const fetchAuctions = async () => {
  try {
    const response = await api.get('/auctions')
    auctions.value = response.data
    error.value = ''
  } catch (err) {
    error.value = err.response?.data?.error || 'Ошибка загрузки аукционов'
  } finally {
    loading.value = false
  }
}

const getStatusText = (status) => {
  const statusMap = {
    scheduled: 'Запланирован',
    active: 'Активен',
    completed: 'Завершён',
    cancelled: 'Отменён'
  }
  return statusMap[status] || status
}

const getStatusBadgeClass = (status) => {
  const classMap = {
    scheduled: 'badge-info',
    active: 'badge-success',
    completed: 'badge-warning',
    cancelled: 'badge-danger'
  }
  return classMap[status] || ''
}

onMounted(() => {
  fetchAuctions()
  interval = setInterval(fetchAuctions, 5000)
})

onUnmounted(() => {
  if (interval) clearInterval(interval)
})
</script>

<style scoped>
.auctions-page {
  padding-bottom: 40px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 32px;
}

.page-description {
  color: var(--text-secondary);
  margin-top: 8px;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 0;
  color: var(--text-secondary);
}

.loading-state .spinner {
  margin-bottom: 16px;
}

.empty-state {
  text-align: center;
  padding: 80px 0;
}

.empty-icon {
  font-size: 64px;
  margin-bottom: 16px;
}

.empty-state h3 {
  color: var(--text-primary);
  margin-bottom: 8px;
}

.empty-state p {
  color: var(--text-secondary);
}

.auctions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 24px;
}

.auction-card {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 16px;
  padding: 24px;
  transition: all 0.3s ease;
}

.auction-card:hover {
  border-color: var(--accent-cyan);
  transform: translateY(-4px);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.currency-badge {
  padding: 4px 10px;
  background: rgba(168, 85, 247, 0.15);
  color: var(--accent-purple);
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
}

.auction-title {
  font-size: 20px;
  font-weight: 600;
  margin-bottom: 8px;
  color: var(--text-primary);
}

.auction-description {
  color: var(--text-secondary);
  font-size: 14px;
  margin-bottom: 20px;
  line-height: 1.5;
}

.auction-stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  padding: 16px;
  background: var(--bg-secondary);
  border-radius: 12px;
  margin-bottom: 16px;
}

.stat {
  display: flex;
  align-items: center;
  gap: 12px;
}

.stat-icon {
  font-size: 24px;
}

.stat-info {
  display: flex;
  flex-direction: column;
}

.stat-value {
  font-family: 'JetBrains Mono', monospace;
  font-weight: 600;
  color: var(--text-primary);
}

.stat-label {
  font-size: 11px;
  color: var(--text-muted);
  text-transform: uppercase;
}

.btn-full {
  width: 100%;
  justify-content: center;
}
</style>
