<template>
  <div class="auction-detail">
    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <p>Загрузка аукциона...</p>
    </div>
    
    <div v-else-if="error" class="alert alert-error">
      <span>⚠️</span> {{ error }}
    </div>
    
    <div v-else class="auction-content">
      <!-- Header -->
      <div class="auction-header">
        <div class="header-info">
          <div class="header-badges">
            <span class="badge" :class="getStatusBadgeClass(auction.status)">
              {{ getStatusText(auction.status) }}
            </span>
            <span class="currency-badge">{{ auction.currency }}</span>
          </div>
          <h1>{{ auction.title }}</h1>
          <p class="description">{{ auction.description }}</p>
        </div>
        
        <div class="header-price" v-if="auction.status === 'active'">
          <span class="price-label">Минимальная ставка</span>
          <div class="price-value">{{ formatBalance(auction.currentMinBid, auction.currency) }}</div>
          <div v-if="auction.nextRoundMinBid" class="next-round-price">
            <span class="next-round-label">Следующий раунд:</span>
            <span class="next-round-value">{{ formatBalance(auction.nextRoundMinBid, auction.currency) }}</span>
          </div>
        </div>
      </div>

      <!-- Stats Grid -->
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon">🔄</div>
          <div class="stat-info">
            <div class="stat-value">{{ auction.currentRound }} / {{ auction.totalRounds }}</div>
            <div class="stat-label">Раунд</div>
            <div class="stat-sublabel" v-if="auction.itemsInCurrentRound">
              🎁 {{ auction.itemsInCurrentRound }} {{ auction.itemsInCurrentRound === 1 ? 'подарок' : auction.itemsInCurrentRound < 5 ? 'подарка' : 'подарков' }} в раунде
            </div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">📦</div>
          <div class="stat-info">
            <div class="stat-value">{{ auction.itemsSold }} / {{ auction.totalItems }}</div>
            <div class="stat-label">Продано лотов</div>
          </div>
        </div>
        <div class="stat-card" v-if="auction.roundEndsAt">
          <div class="stat-icon">⏱️</div>
          <div class="stat-info">
            <div class="stat-value countdown">{{ formatTime(auction.roundEndsAt) }}</div>
            <div class="stat-label">Окончание раунда</div>
          </div>
        </div>
        <div class="stat-card" v-if="auction.userBid">
          <div class="stat-icon">🎯</div>
          <div class="stat-info">
            <div class="stat-value" :class="auction.userBid.rank <= auction.itemsPerRound ? 'text-green' : 'text-orange'">
              #{{ auction.userBid.rank }}
            </div>
            <div class="stat-label">Ваше место</div>
          </div>
        </div>
      </div>

      <div class="main-grid">
        <!-- Left Column -->
        <div class="left-column">
          <!-- Place Bid -->
          <div class="card bid-card" v-if="auction.status === 'active'">
            <h2>💰 Сделать ставку</h2>
            
            <div class="your-bid" v-if="auction.userBid">
              <div class="your-bid-label">Ваша текущая ставка</div>
              <div class="your-bid-value">{{ formatBalance(auction.userBid.amount, auction.currency) }}</div>
              <div class="your-bid-rank" :class="auction.userBid.rank <= auction.itemsPerRound ? 'winning' : 'losing'">
                {{ auction.userBid.rank <= auction.itemsPerRound ? '✅ В зоне победы' : '⚠️ Вне зоны победы' }}
              </div>
            </div>
            
            <div class="form-group">
              <label>Размер ставки</label>
              <div class="bid-input-wrapper">
                <input 
                  v-model="bidAmount" 
                  type="number" 
                  step="0.000000001" 
                  :min="auction.currentMinBid"
                  :placeholder="`Минимум: ${auction.currentMinBid}`"
                />
                <span class="input-currency">{{ auction.currency }}</span>
              </div>
              <small>Минимальная ставка: {{ formatBalance(auction.currentMinBid, auction.currency) }}</small>
            </div>
            
            <button @click="placeBid" class="btn btn-primary btn-full" :disabled="placingBid">
              <span v-if="placingBid" class="spinner-small"></span>
              {{ placingBid ? 'Отправка...' : '🚀 Сделать ставку' }}
            </button>
            
            <div v-if="bidError" class="alert alert-error mt-2">{{ bidError }}</div>
            <div v-if="bidSuccess" class="alert alert-success mt-2">✅ Ставка размещена!</div>
          </div>

          <!-- Top Bids -->
          <div class="card">
            <h2>{{ auction.status === 'completed' ? '🏆 Победители' : '🏆 Топ ставки' }}</h2>
            <div v-if="auction.topBids && auction.topBids.length > 0" class="top-bids-list">
              <div 
                v-for="bid in auction.topBids" 
                :key="bid.userId" 
                class="bid-row"
                :class="{ 
                  'winning': auction.status === 'completed' || bid.rank <= auction.itemsPerRound 
                }"
              >
                <div class="bid-rank">#{{ bid.rank }}</div>
                <div class="bid-user">{{ bid.user }}</div>
                <div class="bid-amount">{{ formatBalance(bid.amount, auction.currency) }}</div>
                <div v-if="auction.status === 'completed'" class="bid-status">🏆 Победитель</div>
              </div>
            </div>
            <div v-else class="empty-bids">
              <span>📭</span>
              <p>{{ auction.status === 'completed' ? 'Победителей нет' : 'Пока нет ставок. Будьте первым!' }}</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import api from '../api'
import { formatBalance } from '../utils/amount'
import { AuctionWebSocket } from '../utils/websocket'
import { useAuthStore } from '../stores/auth'

const route = useRoute()
const authStore = useAuthStore()

const auction = ref({})
const loading = ref(true)
const error = ref('')
const bidAmount = ref('')
const placingBid = ref(false)
const bidError = ref('')
const bidSuccess = ref(false)
const ws = ref(null)

const fetchAuction = async () => {
  try {
    const response = await api.get(`/auctions/${route.params.id}`)
    auction.value = response.data
    error.value = ''
  } catch (err) {
    error.value = err.response?.data?.error || 'Ошибка загрузки аукциона'
  } finally {
    loading.value = false
  }
}

const placeBid = async () => {
  if (!bidAmount.value || parseFloat(bidAmount.value) < parseFloat(auction.value.currentMinBid)) {
    bidError.value = `Минимальная ставка: ${formatBalance(auction.value.currentMinBid, auction.value.currency)}`
    return
  }
  
  placingBid.value = true
  bidError.value = ''
  bidSuccess.value = false
  
  try {
    await api.post(`/auctions/${route.params.id}/bid`, {
      amount: bidAmount.value
    })
    bidSuccess.value = true
    bidAmount.value = ''
    setTimeout(() => {
      bidSuccess.value = false
      fetchAuction()
    }, 2000)
  } catch (err) {
    bidError.value = err.response?.data?.error || 'Ошибка размещения ставки'
  } finally {
    placingBid.value = false
  }
}

const formatTime = (timeString) => {
  if (!timeString) return ''
  const date = new Date(timeString)
  return date.toLocaleString('ru-RU')
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

const setupWebSocket = () => {
  if (!authStore.token) return
  
  ws.value = new AuctionWebSocket(route.params.id, authStore.token)
  
  ws.value.on('snapshot', (data) => {
    auction.value = data
  })
  
  ws.value.on('bid.updated', (data) => {
    if (!data) return
    
    // Мгновенно обновляем минимальную ставку из WebSocket события
    if (data.currentMinBid) {
      auction.value.currentMinBid = data.currentMinBid
    }
    
    // Обновляем топ ставки, если они есть в событии
    if (data.topBids && Array.isArray(data.topBids) && data.topBids.length > 0) {
      // Преобразуем формат: используем user из данных или создаем из userId
      auction.value.topBids = data.topBids.map(bid => ({
        rank: bid.rank,
        amount: bid.amount,
        user: bid.user || (bid.userId ? `user_${bid.userId.slice(-8)}` : 'unknown'),
        userId: bid.userId
      }))
    }
    
    // Также делаем полный fetch для обновления всех данных (но с меньшим приоритетом)
    // Используем debounce, чтобы не делать слишком много запросов
    if (window.bidUpdateTimeout) {
      clearTimeout(window.bidUpdateTimeout)
    }
    window.bidUpdateTimeout = setTimeout(() => {
      fetchAuction()
    }, 1500) // Задержка 1.5 секунды для накопления нескольких обновлений
  })
  
  ws.value.on('round.closed', (data) => {
    fetchAuction()
    alert(`Раунд ${data.roundNumber} завершён! Победителей: ${data.winners.length}`)
  })
  
  ws.value.connect()
}

let interval = null

onMounted(async () => {
  await fetchAuction()
  setupWebSocket()
  
  // Уменьшаем интервал обновления до 2 секунд для более быстрого обновления
  // WebSocket события обновляют данные мгновенно, интервал - только для синхронизации
  interval = setInterval(() => {
    fetchAuction()
  }, 2000)
})

onUnmounted(() => {
  if (interval) clearInterval(interval)
  if (ws.value) ws.value.disconnect()
})
</script>

<style scoped>
.auction-detail {
  padding-bottom: 40px;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 0;
  color: var(--text-secondary);
}

.auction-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 32px;
  padding: 32px;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 20px;
}

.header-badges {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}

.currency-badge {
  padding: 6px 12px;
  background: rgba(168, 85, 247, 0.15);
  color: var(--accent-purple);
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
}

.header-info h1 {
  font-size: 28px;
  margin-bottom: 8px;
}

.description {
  color: var(--text-secondary);
  font-size: 15px;
}

.header-price {
  text-align: right;
  padding: 20px 24px;
  background: rgba(0, 255, 136, 0.1);
  border: 1px solid rgba(0, 255, 136, 0.2);
  border-radius: 16px;
}

.next-round-price {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid rgba(0, 255, 136, 0.2);
}

.next-round-label {
  font-size: 11px;
  color: var(--text-muted);
  text-transform: uppercase;
  display: block;
  margin-bottom: 4px;
}

.next-round-value {
  font-family: 'JetBrains Mono', monospace;
  font-size: 18px;
  font-weight: 600;
  color: var(--accent-cyan);
}

.price-label {
  font-size: 12px;
  color: var(--text-muted);
  text-transform: uppercase;
  margin-bottom: 4px;
  display: block;
}

.price-value {
  font-family: 'JetBrains Mono', monospace;
  font-size: 28px;
  font-weight: 700;
  color: var(--accent-green);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 32px;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 14px;
}

.stat-icon {
  font-size: 28px;
}

.stat-value {
  font-family: 'JetBrains Mono', monospace;
  font-size: 20px;
  font-weight: 600;
  color: var(--text-primary);
}

.stat-label {
  font-size: 12px;
  color: var(--text-muted);
}

.stat-sublabel {
  font-size: 11px;
  color: var(--accent-cyan);
  margin-top: 4px;
  font-weight: 500;
}

.text-green { color: var(--accent-green); }
.text-orange { color: var(--accent-orange); }

.main-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 24px;
}

.bid-card h2 {
  margin-bottom: 20px;
}

.your-bid {
  padding: 20px;
  background: var(--bg-secondary);
  border-radius: 12px;
  margin-bottom: 20px;
  text-align: center;
}

.your-bid-label {
  font-size: 12px;
  color: var(--text-muted);
  margin-bottom: 4px;
}

.your-bid-value {
  font-family: 'JetBrains Mono', monospace;
  font-size: 24px;
  font-weight: 600;
  color: var(--accent-cyan);
  margin-bottom: 8px;
}

.your-bid-rank {
  font-size: 13px;
  font-weight: 500;
}

.your-bid-rank.winning { color: var(--accent-green); }
.your-bid-rank.losing { color: var(--accent-orange); }

.bid-input-wrapper {
  position: relative;
}

.bid-input-wrapper input {
  padding-right: 60px !important;
}

.input-currency {
  position: absolute;
  right: 16px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-muted);
  font-size: 13px;
  font-weight: 500;
}

.btn-full {
  width: 100%;
  justify-content: center;
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

.top-bids-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.bid-row {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  background: var(--bg-secondary);
  border-radius: 10px;
  transition: all 0.2s;
}

.bid-row.winning {
  background: rgba(0, 255, 136, 0.1);
  border: 1px solid rgba(0, 255, 136, 0.2);
}

.bid-rank {
  font-family: 'JetBrains Mono', monospace;
  font-weight: 600;
  color: var(--accent-cyan);
  width: 40px;
}

.bid-user {
  flex: 1;
  color: var(--text-secondary);
}

.bid-amount {
  font-family: 'JetBrains Mono', monospace;
  font-weight: 500;
  color: var(--text-primary);
}

.bid-status {
  font-size: 11px;
  color: var(--accent-green);
  font-weight: 600;
  margin-left: auto;
  padding-left: 12px;
}

.empty-bids {
  text-align: center;
  padding: 40px;
  color: var(--text-secondary);
}

.empty-bids span {
  font-size: 48px;
  display: block;
  margin-bottom: 12px;
}

@media (max-width: 1024px) {
  .auction-header {
    flex-direction: column;
    gap: 24px;
  }
  
  .header-price {
    text-align: left;
    width: 100%;
  }
}
</style>
