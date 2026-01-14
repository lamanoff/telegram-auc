<template>
  <div class="admin-page">
    <h1>⚙️ Админ панель</h1>
    
    <!-- Tabs -->
    <div class="tabs">
      <button 
        v-for="tab in tabs" 
        :key="tab.id"
        @click="activeTab = tab.id"
        :class="['tab', { active: activeTab === tab.id }]"
      >
        {{ tab.icon }} {{ tab.label }}
      </button>
    </div>

    <!-- Stats Tab -->
    <div v-if="activeTab === 'stats'" class="tab-content">
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon">👥</div>
          <div class="stat-info">
            <div class="stat-value">{{ stats.users }}</div>
            <div class="stat-label">Пользователей</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">🎯</div>
          <div class="stat-info">
            <div class="stat-value">{{ stats.auctions }}</div>
            <div class="stat-label">Аукционов</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">💰</div>
          <div class="stat-info">
            <div class="stat-value">{{ stats.bids }}</div>
            <div class="stat-label">Ставок</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">📊</div>
          <div class="stat-info">
            <div class="stat-value">{{ stats.transactions }}</div>
            <div class="stat-label">Транзакций</div>
          </div>
        </div>
      </div>

      <!-- Volume Stats -->
      <div class="card" v-if="analytics.volume && analytics.volume.length">
        <h2>💵 Объём выплат</h2>
        <div class="volume-grid">
          <div v-for="vol in analytics.volume" :key="vol.currency" class="volume-card">
            <span class="currency-badge">{{ vol.currency }}</span>
            <span class="volume-amount">{{ vol.total }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Auctions Tab -->
    <div v-if="activeTab === 'auctions'" class="tab-content">
      <div class="card">
        <div class="card-header">
          <h2>📋 Управление аукционами</h2>
          <button @click="fetchAuctions" class="btn btn-secondary btn-sm">🔄 Обновить</button>
        </div>
        
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Название</th>
                <th>Статус</th>
                <th>Раунд</th>
                <th>Продано</th>
                <th>Валюта</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="auction in auctions" :key="auction.id">
                <td>
                  <router-link :to="`/auctions/${auction.id}`" class="auction-link">
                    {{ auction.title }}
                  </router-link>
                </td>
                <td>
                  <span :class="['badge', getStatusClass(auction.status)]">
                    {{ getStatusText(auction.status) }}
                  </span>
                </td>
                <td>{{ auction.currentRound }} / {{ auction.roundsCount }}</td>
                <td>{{ auction.itemsSold }} / {{ auction.totalItems }}</td>
                <td><span class="currency-badge small">{{ auction.currency }}</span></td>
                <td class="actions">
                  <button 
                    v-if="auction.status === 'scheduled' || auction.status === 'active'"
                    @click="cancelAuction(auction.id)"
                    class="btn btn-danger btn-sm"
                    :disabled="cancelling === auction.id"
                  >
                    {{ cancelling === auction.id ? '...' : '❌ Отменить' }}
                  </button>
                  <router-link 
                    :to="`/auctions/${auction.id}`" 
                    class="btn btn-secondary btn-sm"
                  >
                    👁️ Открыть
                  </router-link>
                </td>
              </tr>
              <tr v-if="auctions.length === 0">
                <td colspan="6" class="empty">Нет аукционов</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Transactions Tab -->
    <div v-if="activeTab === 'transactions'" class="tab-content">
      <div class="card">
        <div class="card-header">
          <h2>💳 Транзакции</h2>
          <button @click="fetchTransactions" class="btn btn-secondary btn-sm">🔄 Обновить</button>
        </div>
        
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Тип</th>
                <th>Сумма</th>
                <th>Статус</th>
                <th>Провайдер</th>
                <th>Дата</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="tx in transactions" :key="tx.id">
                <td class="mono">{{ tx.id.slice(0, 8) }}...</td>
                <td>
                  <span :class="['type-badge', tx.type]">{{ getTypeText(tx.type) }}</span>
                </td>
                <td class="mono">{{ tx.amount }} {{ tx.currency }}</td>
                <td>
                  <span :class="['badge', getStatusClass(tx.status)]">
                    {{ tx.status }}
                  </span>
                </td>
                <td>{{ tx.provider || '-' }}</td>
                <td>{{ formatDate(tx.createdAt) }}</td>
              </tr>
              <tr v-if="transactions.length === 0">
                <td colspan="6" class="empty">Нет транзакций</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Events Tab -->
    <div v-if="activeTab === 'events'" class="tab-content">
      <div class="card">
        <div class="card-header">
          <h2>📝 События системы</h2>
          <button @click="fetchEvents" class="btn btn-secondary btn-sm">🔄 Обновить</button>
        </div>
        
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Тип</th>
                <th>Пользователь</th>
                <th>Аукцион</th>
                <th>Данные</th>
                <th>Дата</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="event in events" :key="event.id">
                <td><code>{{ event.type }}</code></td>
                <td class="mono">{{ event.userId ? event.userId.slice(0, 8) + '...' : '-' }}</td>
                <td class="mono">{{ event.auctionId ? event.auctionId.slice(0, 8) + '...' : '-' }}</td>
                <td class="payload">{{ event.payload ? JSON.stringify(event.payload).slice(0, 50) : '-' }}</td>
                <td>{{ formatDate(event.createdAt) }}</td>
              </tr>
              <tr v-if="events.length === 0">
                <td colspan="5" class="empty">Нет событий</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Create Auction Tab -->
    <div v-if="activeTab === 'create'" class="tab-content">
      <div class="card create-auction-card">
        <div class="card-header-section">
          <h2>➕ Создать аукцион</h2>
          <p class="card-description">Настройте параметры нового аукциона</p>
        </div>
        
        <form @submit.prevent="createAuction" class="auction-form">
          <div class="form-section">
            <h3>📝 Основная информация</h3>
            <div class="form-row">
              <div class="form-group">
                <label>Название аукциона</label>
                <input v-model="form.title" type="text" placeholder="Например: Premium NFT Collection" required />
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Описание</label>
                <textarea v-model="form.description" rows="3" placeholder="Опишите что продаётся на аукционе..."></textarea>
              </div>
            </div>
          </div>
          
          <div class="form-section">
            <h3>💰 Финансы</h3>
            <div class="form-row three-col">
              <div class="form-group">
                <label>Валюта</label>
                <select v-model="form.currency" required>
                  <option value="TON">TON</option>
                  <option value="USDT">USDT</option>
                </select>
              </div>
              <div class="form-group">
                <label>Начальная цена</label>
                <input v-model="form.startingPrice" type="number" step="0.000000001" placeholder="1.0" required />
              </div>
              <div class="form-group">
                <label>Минимальный шаг</label>
                <input v-model="form.minIncrement" type="number" step="0.000000001" placeholder="0.1" required />
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Резервная цена (опционально)</label>
                <input v-model="form.reservePrice" type="number" step="0.000000001" placeholder="Не установлена" />
              </div>
            </div>
          </div>
          
          <div class="form-section">
            <h3>🎯 Раунды и лоты</h3>
            <div class="form-row three-col">
              <div class="form-group">
                <label>Количество раундов</label>
                <input v-model.number="form.roundsCount" type="number" min="1" placeholder="5" required />
              </div>
              <div class="form-group">
                <label>Лотов на раунд</label>
                <input v-model.number="form.itemsPerRound" type="number" min="1" placeholder="10" required />
              </div>
              <div class="form-group">
                <label>Всего лотов (авто)</label>
                <input v-model.number="form.totalItems" type="number" :placeholder="form.roundsCount * form.itemsPerRound || '50'" />
              </div>
            </div>
          </div>
          
          <div class="form-section">
            <h3>⏱️ Тайминги</h3>
            <div class="form-row three-col">
              <div class="form-group">
                <label>Дата начала</label>
                <input v-model="form.startTime" type="datetime-local" required />
              </div>
              <div class="form-group">
                <label>Длительность первого раунда (сек)</label>
                <input v-model.number="form.firstRoundDurationSec" type="number" min="60" placeholder="300" required />
              </div>
              <div class="form-group">
                <label>Длительность раунда (сек)</label>
                <input v-model.number="form.roundDurationSec" type="number" min="60" placeholder="300" required />
              </div>
            </div>
          </div>
          
          <div class="form-actions">
            <button type="submit" class="btn btn-primary btn-lg" :disabled="creating">
              <span v-if="creating" class="spinner-small"></span>
              {{ creating ? 'Создание...' : '🚀 Создать аукцион' }}
            </button>
          </div>
          
          <div v-if="createError" class="alert alert-error mt-2">
            <span>⚠️</span> {{ createError }}
          </div>
          <div v-if="createSuccess" class="alert alert-success mt-2">
            <span>✅</span> Аукцион создан! ID: <code>{{ createdAuctionId }}</code>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '../api'

const tabs = [
  { id: 'stats', icon: '📊', label: 'Статистика' },
  { id: 'auctions', icon: '🎯', label: 'Аукционы' },
  { id: 'transactions', icon: '💳', label: 'Транзакции' },
  { id: 'events', icon: '📝', label: 'События' },
  { id: 'create', icon: '➕', label: 'Создать' },
]

const activeTab = ref('stats')

// Stats
const stats = ref({ users: 0, auctions: 0, bids: 0, transactions: 0 })
const analytics = ref({ auctions: [], volume: [] })

// Auctions
const auctions = ref([])
const cancelling = ref(null)

// Transactions
const transactions = ref([])

// Events
const events = ref([])

// Create auction form
const form = ref({
  title: '',
  description: '',
  currency: 'TON',
  roundsCount: 5,
  itemsPerRound: 10,
  totalItems: null,
  startTime: '',
  firstRoundDurationSec: 300,
  roundDurationSec: 300,
  startingPrice: '1',
  minIncrement: '0.1',
  reservePrice: ''
})
const creating = ref(false)
const createError = ref('')
const createSuccess = ref(false)
const createdAuctionId = ref('')

// Fetch functions
const fetchStats = async () => {
  try {
    const [logsRes, analyticsRes] = await Promise.all([
      api.get('/admin/logs'),
      api.get('/admin/analytics')
    ])
    stats.value = logsRes.data
    analytics.value = analyticsRes.data
  } catch (err) {
    console.error('Error fetching stats:', err)
  }
}

const fetchAuctions = async () => {
  try {
    const response = await api.get('/auctions')
    auctions.value = response.data
  } catch (err) {
    console.error('Error fetching auctions:', err)
  }
}

const fetchTransactions = async () => {
  try {
    const response = await api.get('/admin/transactions')
    transactions.value = response.data
  } catch (err) {
    console.error('Error fetching transactions:', err)
  }
}

const fetchEvents = async () => {
  try {
    const response = await api.get('/admin/events')
    events.value = response.data
  } catch (err) {
    console.error('Error fetching events:', err)
  }
}

const cancelAuction = async (id) => {
  if (!confirm('Вы уверены, что хотите отменить аукцион? Все ставки будут возвращены.')) {
    return
  }
  cancelling.value = id
  try {
    await api.post(`/auctions/${id}/cancel`)
    await fetchAuctions()
  } catch (err) {
    alert(err.response?.data?.error || 'Ошибка отмены аукциона')
  } finally {
    cancelling.value = null
  }
}

const createAuction = async () => {
  creating.value = true
  createError.value = ''
  createSuccess.value = false
  
  try {
    const data = {
      ...form.value,
      startTime: new Date(form.value.startTime).toISOString()
    }
    if (!data.totalItems) {
      delete data.totalItems
    }
    if (!data.reservePrice) {
      delete data.reservePrice
    }
    
    const response = await api.post('/auctions', data)
    createdAuctionId.value = response.data.id
    createSuccess.value = true
    
    form.value = {
      title: '',
      description: '',
      currency: 'TON',
      roundsCount: 5,
      itemsPerRound: 10,
      totalItems: null,
      startTime: '',
      firstRoundDurationSec: 300,
      roundDurationSec: 300,
      startingPrice: '1',
      minIncrement: '0.1',
      reservePrice: ''
    }
    
    await fetchAuctions()
  } catch (err) {
    createError.value = err.response?.data?.error || 'Ошибка создания аукциона'
  } finally {
    creating.value = false
  }
}

// Helpers
const getStatusText = (status) => {
  const map = {
    scheduled: 'Запланирован',
    active: 'Активен',
    completed: 'Завершён',
    cancelled: 'Отменён',
    pending: 'Ожидание',
    failed: 'Ошибка'
  }
  return map[status] || status
}

const getStatusClass = (status) => {
  const map = {
    scheduled: 'badge-info',
    active: 'badge-success',
    completed: 'badge-warning',
    cancelled: 'badge-danger',
    pending: 'badge-info',
    failed: 'badge-danger'
  }
  return map[status] || ''
}

const getTypeText = (type) => {
  const map = {
    deposit: '📥 Депозит',
    withdrawal: '📤 Вывод',
    bid_lock: '🔒 Блокировка',
    bid_refund: '🔓 Возврат',
    payout: '💸 Выплата'
  }
  return map[type] || type
}

const formatDate = (dateStr) => {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleString('ru-RU')
}

onMounted(() => {
  fetchStats()
  fetchAuctions()
  fetchTransactions()
  fetchEvents()
})
</script>

<style scoped>
.admin-page {
  padding-bottom: 40px;
}

/* Tabs */
.tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 24px;
  flex-wrap: wrap;
}

.tab {
  padding: 12px 20px;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
  font-weight: 500;
}

.tab:hover {
  border-color: var(--accent-cyan);
  color: var(--text-primary);
}

.tab.active {
  background: var(--accent-cyan);
  border-color: var(--accent-cyan);
  color: #000;
}

/* Stats Grid */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 24px;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 14px;
}

.stat-icon {
  font-size: 32px;
}

.stat-value {
  font-family: 'JetBrains Mono', monospace;
  font-size: 28px;
  font-weight: 700;
  color: var(--accent-cyan);
}

.stat-label {
  font-size: 13px;
  color: var(--text-muted);
}

/* Volume */
.volume-grid {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.volume-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 24px;
  background: var(--bg-secondary);
  border-radius: 10px;
}

.volume-amount {
  font-family: 'JetBrains Mono', monospace;
  font-size: 20px;
  font-weight: 600;
  color: var(--accent-green);
}

/* Card Header */
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.card-header h2 {
  margin: 0;
}

/* Tables */
.table-container {
  overflow-x: auto;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
}

.data-table th,
.data-table td {
  padding: 12px 16px;
  text-align: left;
  border-bottom: 1px solid var(--border-color);
}

.data-table th {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  background: var(--bg-secondary);
}

.data-table tr:hover {
  background: var(--bg-secondary);
}

.data-table .empty {
  text-align: center;
  color: var(--text-muted);
  padding: 40px;
}

.data-table .mono {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
}

.data-table .payload {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: var(--text-secondary);
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.data-table .actions {
  display: flex;
  gap: 8px;
}

.auction-link {
  color: var(--accent-cyan);
  text-decoration: none;
  font-weight: 500;
}

.auction-link:hover {
  text-decoration: underline;
}

/* Badges */
.badge {
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
}

.badge-info {
  background: rgba(0, 212, 255, 0.15);
  color: var(--accent-cyan);
}

.badge-success {
  background: rgba(0, 255, 136, 0.15);
  color: var(--accent-green);
}

.badge-warning {
  background: rgba(255, 170, 0, 0.15);
  color: var(--accent-orange);
}

.badge-danger {
  background: rgba(255, 85, 85, 0.15);
  color: #ff5555;
}

.currency-badge {
  padding: 4px 10px;
  background: rgba(168, 85, 247, 0.15);
  color: var(--accent-purple);
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
}

.currency-badge.small {
  padding: 2px 6px;
  font-size: 10px;
}

.type-badge {
  font-size: 12px;
}

/* Buttons */
.btn-sm {
  padding: 6px 12px;
  font-size: 12px;
}

.btn-danger {
  background: rgba(255, 85, 85, 0.15);
  color: #ff5555;
  border: 1px solid rgba(255, 85, 85, 0.3);
}

.btn-danger:hover {
  background: rgba(255, 85, 85, 0.25);
}

/* Create Form */
.create-auction-card {
  max-width: 900px;
}

.card-header-section {
  margin-bottom: 32px;
}

.card-description {
  color: var(--text-secondary);
  margin-top: 8px;
}

.auction-form {
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.form-section {
  padding: 24px;
  background: var(--bg-secondary);
  border-radius: 16px;
}

.form-section h3 {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 20px;
  color: var(--text-primary);
}

.form-row {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
}

.form-row.three-col {
  grid-template-columns: repeat(3, 1fr);
}

@media (max-width: 768px) {
  .form-row.three-col {
    grid-template-columns: 1fr;
  }
}

.form-actions {
  display: flex;
  justify-content: flex-end;
}

.btn-lg {
  padding: 16px 32px;
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
  display: inline-block;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

code {
  font-family: 'JetBrains Mono', monospace;
  background: var(--bg-secondary);
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 13px;
}

.mt-2 {
  margin-top: 16px;
}
</style>
