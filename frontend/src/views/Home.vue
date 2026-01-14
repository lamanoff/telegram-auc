<template>
  <div class="home">
    <div class="hero">
      <div class="hero-content">
        <div class="hero-badge">🚀 Криптовалютные аукционы нового поколения</div>
        <h1 class="hero-title">
          <span class="gradient-text">CryptoAuction</span>
          <br />Platform
        </h1>
        <p class="hero-description">
          Участвуйте в многораундовых аукционах с мгновенными криптовалютными расчётами.
          Безопасно, прозрачно, децентрализовано.
        </p>
        <div class="hero-actions">
          <router-link to="/auctions" v-if="authStore.isAuthenticated" class="btn btn-primary btn-lg">
            <span>📊</span> Перейти к аукционам
          </router-link>
          <template v-else>
            <router-link to="/register" class="btn btn-primary btn-lg">
              Начать торговать
            </router-link>
            <router-link to="/login" class="btn btn-secondary btn-lg">
              Войти в аккаунт
            </router-link>
          </template>
        </div>
      </div>
      <div class="hero-visual">
        <div class="floating-card card-1">
          <div class="card-icon">💎</div>
          <div class="card-value">+24.5%</div>
        </div>
        <div class="floating-card card-2">
          <div class="card-icon">📈</div>
          <div class="card-value">1,234 TON</div>
        </div>
        <div class="floating-card card-3">
          <div class="card-icon">🏆</div>
          <div class="card-value">Winner!</div>
        </div>
      </div>
    </div>

    <div class="features">
      <div class="feature-card">
        <div class="feature-icon">⚡</div>
        <h3>Мгновенные ставки</h3>
        <p>Ставки обрабатываются в реальном времени через WebSocket соединение</p>
      </div>
      <div class="feature-card">
        <div class="feature-icon">🔒</div>
        <h3>Безопасность</h3>
        <p>Все транзакции защищены и проверяются через CryptoBot</p>
      </div>
      <div class="feature-card">
        <div class="feature-icon">🎯</div>
        <h3>Многораундовая система</h3>
        <p>Несколько победителей в каждом раунде, больше шансов выиграть</p>
      </div>
      <div class="feature-card">
        <div class="feature-icon">💰</div>
        <h3>Крипто расчёты</h3>
        <p>Депозиты и выводы в TON и USDT без комиссий платформы</p>
      </div>
    </div>

    <div class="stats-section">
      <div class="stat-item">
        <div class="stat-number">10K+</div>
        <div class="stat-label">Пользователей</div>
      </div>
      <div class="stat-item">
        <div class="stat-number">500+</div>
        <div class="stat-label">Аукционов</div>
      </div>
      <div class="stat-item">
        <div class="stat-number">1M+</div>
        <div class="stat-label">TON в обороте</div>
      </div>
      <div class="stat-item">
        <div class="stat-number">99.9%</div>
        <div class="stat-label">Uptime</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useAuthStore } from '../stores/auth'

const authStore = useAuthStore()
</script>

<style scoped>
.home {
  padding-bottom: 60px;
}

.hero {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 60px;
  align-items: center;
  padding: 60px 0 80px;
}

.hero-badge {
  display: inline-block;
  padding: 8px 16px;
  background: rgba(0, 212, 255, 0.1);
  border: 1px solid rgba(0, 212, 255, 0.2);
  border-radius: 20px;
  font-size: 13px;
  color: var(--accent-cyan);
  margin-bottom: 24px;
}

.hero-title {
  font-size: 56px;
  font-weight: 800;
  line-height: 1.1;
  margin-bottom: 24px;
  color: var(--text-primary);
}

.gradient-text {
  background: var(--gradient-primary);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.hero-description {
  font-size: 18px;
  color: var(--text-secondary);
  margin-bottom: 32px;
  max-width: 480px;
  line-height: 1.7;
}

.hero-actions {
  display: flex;
  gap: 16px;
}

.btn-lg {
  padding: 16px 32px;
  font-size: 16px;
}

.hero-visual {
  position: relative;
  height: 400px;
}

.floating-card {
  position: absolute;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 16px;
  padding: 20px 28px;
  display: flex;
  align-items: center;
  gap: 12px;
  animation: float 3s ease-in-out infinite;
}

.floating-card .card-icon {
  font-size: 28px;
}

.floating-card .card-value {
  font-family: 'JetBrains Mono', monospace;
  font-weight: 600;
  font-size: 18px;
  color: var(--accent-green);
}

.card-1 {
  top: 20%;
  left: 10%;
  animation-delay: 0s;
}

.card-2 {
  top: 45%;
  right: 10%;
  animation-delay: 1s;
}

.card-3 {
  bottom: 15%;
  left: 25%;
  animation-delay: 2s;
}

.card-3 .card-value {
  color: var(--accent-yellow);
}

@keyframes float {
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-15px); }
}

.features {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 24px;
  margin: 60px 0;
}

.feature-card {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 16px;
  padding: 32px 24px;
  text-align: center;
  transition: all 0.3s ease;
}

.feature-card:hover {
  border-color: var(--accent-cyan);
  transform: translateY(-4px);
}

.feature-icon {
  font-size: 40px;
  margin-bottom: 16px;
}

.feature-card h3 {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 8px;
  color: var(--text-primary);
}

.feature-card p {
  font-size: 14px;
  color: var(--text-secondary);
  line-height: 1.5;
}

.stats-section {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 32px;
  padding: 48px;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 20px;
}

.stat-item {
  text-align: center;
}

.stat-number {
  font-size: 42px;
  font-weight: 700;
  font-family: 'JetBrains Mono', monospace;
  background: var(--gradient-primary);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.stat-label {
  font-size: 14px;
  color: var(--text-muted);
  margin-top: 8px;
}

@media (max-width: 1024px) {
  .hero {
    grid-template-columns: 1fr;
    text-align: center;
  }
  
  .hero-description {
    margin: 0 auto 32px;
  }
  
  .hero-actions {
    justify-content: center;
  }
  
  .hero-visual {
    display: none;
  }
  
  .features {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .stats-section {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 640px) {
  .hero-title {
    font-size: 36px;
  }
  
  .features, .stats-section {
    grid-template-columns: 1fr;
  }
  
  .hero-actions {
    flex-direction: column;
  }
}
</style>
