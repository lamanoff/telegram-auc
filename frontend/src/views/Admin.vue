<template>
  <div class="admin-page">
    <h1>⚙️ Админ панель</h1>
    
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
</template>

<script setup>
import { ref } from 'vue'
import api from '../api'

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
  } catch (err) {
    createError.value = err.response?.data?.error || 'Ошибка создания аукциона'
  } finally {
    creating.value = false
  }
}
</script>

<style scoped>
.admin-page {
  padding-bottom: 40px;
}

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
</style>
