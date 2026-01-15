<template>
  <div class="profile-page">
    <h1>👤 Профиль</h1>
    
    <!-- Balance Cards -->
    <div class="balance-section">
      <div class="balance-card">
        <div class="balance-icon">💎</div>
        <div class="balance-info">
          <div class="balance-currency">TON</div>
          <div class="balance-total">{{ formatBalance(balances.TON?.total || '0', 'TON') }}</div>
          <div class="balance-details">
            <div class="balance-row">
              <span>Доступно:</span>
              <span class="available">{{ formatBalance(balances.TON?.available || '0', 'TON') }}</span>
            </div>
            <div class="balance-row">
              <span>Заблокировано:</span>
              <span class="locked">{{ formatBalance(balances.TON?.locked || '0', 'TON') }}</span>
            </div>
          </div>
        </div>
      </div>
      
      <div class="balance-card">
        <div class="balance-icon">💵</div>
        <div class="balance-info">
          <div class="balance-currency">USDT</div>
          <div class="balance-total">{{ formatBalance(balances.USDT?.total || '0', 'USDT') }}</div>
          <div class="balance-details">
            <div class="balance-row">
              <span>Доступно:</span>
              <span class="available">{{ formatBalance(balances.USDT?.available || '0', 'USDT') }}</span>
            </div>
            <div class="balance-row">
              <span>Заблокировано:</span>
              <span class="locked">{{ formatBalance(balances.USDT?.locked || '0', 'USDT') }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Actions -->
    <div class="actions-grid">
      <!-- Deposit -->
      <div class="card">
        <h2>📥 Депозит</h2>
        <div class="form-group">
          <label>Валюта</label>
          <select v-model="depositCurrency">
            <option value="TON">TON</option>
            <option value="USDT">USDT</option>
          </select>
        </div>
        <div class="form-group">
          <label>Сумма</label>
          <input v-model="depositAmount" type="number" step="0.000000001" placeholder="0.00" />
        </div>
        <button @click="createDeposit" class="btn btn-primary btn-full" :disabled="depositing">
          {{ depositing ? 'Создание...' : '💳 Создать депозит' }}
        </button>
        <div v-if="depositInvoice" class="alert alert-success mt-2">
          <span>✅</span>
          <div>
            <strong>Ссылка для оплаты:</strong>
            <a :href="depositInvoice.payUrl" target="_blank" rel="noopener">
              {{ depositInvoice.payUrl }}
            </a>
          </div>
        </div>
      </div>

      <!-- Withdraw -->
      <div class="card">
        <h2>📤 Вывод</h2>
        <div class="form-group">
          <label>Валюта</label>
          <select v-model="withdrawCurrency">
            <option value="TON">TON</option>
            <option value="USDT">USDT</option>
          </select>
        </div>
        <div class="form-group">
          <label>Сумма</label>
          <input v-model="withdrawAmount" type="number" step="0.000000001" placeholder="0.00" />
        </div>
        <div class="form-group">
          <label>Адрес получателя</label>
          <input v-model="withdrawAddress" type="text" placeholder="Введите адрес кошелька" />
        </div>
        <button @click="withdraw" class="btn btn-danger btn-full" :disabled="withdrawing">
          {{ withdrawing ? 'Вывод...' : '🚀 Вывести' }}
        </button>
      </div>
    </div>

    <!-- Transactions -->
    <div class="card">
      <h2>📋 История транзакций</h2>
      <div v-if="transactionsLoading" class="loading-state">
        <div class="spinner"></div>
      </div>
      <div v-else-if="transactions.length === 0" class="empty-state">
        <span>📭</span>
        <p>Транзакций пока нет</p>
      </div>
      <div v-else class="transactions-table">
        <table>
          <thead>
            <tr>
              <th>Тип</th>
              <th>Валюта</th>
              <th>Сумма</th>
              <th>Статус</th>
              <th>Дата</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="tx in transactions" :key="tx.id">
              <td>
                <span class="tx-type" :class="getTypeClass(tx.type)">
                  {{ getTransactionIcon(tx.type) }} {{ getTransactionType(tx.type) }}
                </span>
              </td>
              <td>
                <span class="currency-badge-small">{{ tx.currency }}</span>
              </td>
              <td class="tx-amount" :class="getAmountClass(tx.type)">
                {{ getAmountPrefix(tx.type) }}{{ formatBalance(tx.amount, tx.currency) }}
              </td>
              <td>
                <span class="badge" :class="getStatusClass(tx.status)">
                  {{ tx.status }}
                </span>
              </td>
              <td class="tx-date">{{ formatTime(tx.createdAt) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '../api'
import { formatBalance } from '../utils/amount'

const balances = ref({ TON: {}, USDT: {} })
const depositCurrency = ref('TON')
const depositAmount = ref('')
const depositing = ref(false)
const depositInvoice = ref(null)
const withdrawCurrency = ref('TON')
const withdrawAmount = ref('')
const withdrawAddress = ref('')
const withdrawing = ref(false)
const transactions = ref([])
const transactionsLoading = ref(true)

const fetchProfile = async () => {
  try {
    const response = await api.get('/profile')
    balances.value = response.data.balances
  } catch (err) {
    console.error('Error fetching profile:', err)
  }
}

const fetchTransactions = async () => {
  try {
    transactionsLoading.value = true
    const response = await api.get('/transactions')
    transactions.value = response.data
  } catch (err) {
    console.error('Error fetching transactions:', err)
  } finally {
    transactionsLoading.value = false
  }
}

const createDeposit = async () => {
  if (!depositAmount.value) return
  
  depositing.value = true
  depositInvoice.value = null
  
  try {
    const response = await api.post('/deposit', {
      provider: 'cryptobot',
      currency: depositCurrency.value,
      amount: depositAmount.value
    })
    depositInvoice.value = response.data.invoice
  } catch (err) {
    alert(err.response?.data?.error || 'Ошибка создания депозита')
  } finally {
    depositing.value = false
  }
}

const withdraw = async () => {
  if (!withdrawAmount.value || !withdrawAddress.value) {
    alert('Заполните все поля')
    return
  }
  
  withdrawing.value = true
  
  try {
    await api.post('/withdraw', {
      provider: 'cryptobot',
      currency: withdrawCurrency.value,
      amount: withdrawAmount.value,
      destination: withdrawAddress.value
    })
    alert('Вывод выполнен успешно')
    withdrawAmount.value = ''
    withdrawAddress.value = ''
    fetchProfile()
    fetchTransactions()
  } catch (err) {
    alert(err.response?.data?.error || 'Ошибка вывода')
  } finally {
    withdrawing.value = false
  }
}

const getTransactionType = (type) => {
  const typeMap = {
    deposit: 'Депозит',
    withdrawal: 'Вывод',
    bid_lock: 'Блокировка',
    bid_refund: 'Возврат',
    payout: 'Выплата'
  }
  return typeMap[type] || type
}

const getTransactionIcon = (type) => {
  const iconMap = {
    deposit: '📥',
    withdrawal: '📤',
    bid_lock: '🔒',
    bid_refund: '↩️',
    payout: '🏆'
  }
  return iconMap[type] || '💰'
}

const getTypeClass = (type) => {
  const classMap = {
    deposit: 'type-deposit',
    withdrawal: 'type-withdrawal',
    bid_lock: 'type-lock',
    bid_refund: 'type-refund',
    payout: 'type-payout'
  }
  return classMap[type] || ''
}

const getAmountClass = (type) => {
  if (['deposit', 'bid_refund', 'payout'].includes(type)) return 'amount-positive'
  return 'amount-negative'
}

const getAmountPrefix = (type) => {
  if (['deposit', 'bid_refund', 'payout'].includes(type)) return '+'
  return '-'
}

const getStatusClass = (status) => {
  const classMap = {
    completed: 'badge-success',
    pending: 'badge-warning',
    failed: 'badge-danger'
  }
  return classMap[status] || 'badge-info'
}

const formatTime = (timeString) => {
  if (!timeString) return ''
  const date = new Date(timeString)
  return date.toLocaleString('ru-RU')
}

onMounted(() => {
  fetchProfile()
  fetchTransactions()
})
</script>

<style scoped>
.profile-page {
  padding-bottom: 40px;
}

.balance-section {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 24px;
  margin-bottom: 32px;
}

.balance-card {
  display: flex;
  gap: 20px;
  padding: 28px;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 20px;
}

.balance-icon {
  font-size: 48px;
}

.balance-info {
  flex: 1;
}

.balance-currency {
  font-size: 14px;
  color: var(--text-muted);
  margin-bottom: 4px;
}

.balance-total {
  font-family: 'JetBrains Mono', monospace;
  font-size: 32px;
  font-weight: 700;
  background: var(--gradient-primary);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin-bottom: 16px;
}

.balance-details {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.balance-row {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  color: var(--text-secondary);
}

.balance-row .available {
  color: var(--accent-green);
  font-family: 'JetBrains Mono', monospace;
}

.balance-row .locked {
  color: var(--accent-orange);
  font-family: 'JetBrains Mono', monospace;
}

.actions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
  gap: 24px;
  margin-bottom: 32px;
}

.btn-full {
  width: 100%;
  justify-content: center;
}

.loading-state {
  display: flex;
  justify-content: center;
  padding: 40px;
}

.empty-state {
  text-align: center;
  padding: 40px;
  color: var(--text-secondary);
}

.empty-state span {
  font-size: 48px;
  display: block;
  margin-bottom: 12px;
}

.transactions-table {
  overflow-x: auto;
}

.tx-type {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
}

.type-deposit { color: var(--accent-green); }
.type-withdrawal { color: var(--accent-red); }
.type-lock { color: var(--accent-orange); }
.type-refund { color: var(--accent-cyan); }
.type-payout { color: var(--accent-yellow); }

.tx-amount {
  font-family: 'JetBrains Mono', monospace;
  font-weight: 600;
}

.amount-positive { color: var(--accent-green); }
.amount-negative { color: var(--accent-red); }

.currency-badge-small {
  padding: 2px 8px;
  background: rgba(168, 85, 247, 0.15);
  color: var(--accent-purple);
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
}

.tx-date {
  color: var(--text-muted);
  font-size: 13px;
}
</style>
