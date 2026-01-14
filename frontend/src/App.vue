<template>
  <div id="app">
    <nav class="navbar">
      <div class="container">
        <div class="nav-content">
          <router-link to="/" class="logo">
            <span class="logo-icon">◈</span>
            <span class="logo-text">CryptoAuction</span>
          </router-link>
          <div class="nav-links">
            <template v-if="authStore.isAuthenticated">
              <router-link to="/auctions" class="nav-link">
                <span class="nav-icon">📊</span>
                Аукционы
              </router-link>
              <router-link to="/profile" class="nav-link">
                <span class="nav-icon">👤</span>
                Профиль
              </router-link>
              <div class="balance-display">
                <span class="balance-label">Баланс</span>
                <span class="balance-value">{{ formatBalance(authStore.user?.balances?.TON?.available || '0', 'TON') }}</span>
              </div>
              <button @click="handleLogout" class="btn-logout">
                Выход
              </button>
            </template>
            <template v-else>
              <router-link to="/login" class="nav-link">Вход</router-link>
              <router-link to="/register" class="btn btn-primary">Регистрация</router-link>
            </template>
          </div>
        </div>
      </div>
    </nav>
    <main class="container main-content">
      <router-view />
    </main>
    <footer class="footer">
      <div class="container">
        <p>© 2026 CryptoAuction Platform · Powered by Blockchain</p>
      </div>
    </footer>
  </div>
</template>

<script setup>
import { useAuthStore } from './stores/auth'
import { formatBalance } from './utils/amount'

const authStore = useAuthStore()

const handleLogout = () => {
  authStore.logout()
}
</script>

<style scoped>
.navbar {
  background: rgba(17, 24, 39, 0.95);
  backdrop-filter: blur(20px);
  border-bottom: 1px solid var(--border-color);
  position: sticky;
  top: 0;
  z-index: 100;
}

.nav-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 0;
}

.logo {
  display: flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
}

.logo-icon {
  font-size: 28px;
  background: var(--gradient-primary);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  animation: glow-pulse 3s ease-in-out infinite;
}

.logo-text {
  font-size: 22px;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -0.5px;
}

.nav-links {
  display: flex;
  gap: 8px;
  align-items: center;
}

.nav-link {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 16px;
  color: var(--text-secondary);
  text-decoration: none;
  font-weight: 500;
  font-size: 14px;
  border-radius: 10px;
  transition: all 0.2s ease;
}

.nav-link:hover {
  color: var(--text-primary);
  background: var(--bg-card);
}

.nav-link.router-link-active {
  color: var(--accent-cyan);
  background: rgba(0, 212, 255, 0.1);
}

.nav-icon {
  font-size: 16px;
}

.balance-display {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  padding: 8px 16px;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  margin: 0 8px;
}

.balance-label {
  font-size: 10px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.balance-value {
  font-family: 'JetBrains Mono', monospace;
  font-size: 14px;
  font-weight: 600;
  color: var(--accent-green);
}

.btn-logout {
  padding: 10px 16px;
  background: transparent;
  border: 1px solid var(--accent-red);
  color: var(--accent-red);
  border-radius: 10px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  font-family: 'Inter', sans-serif;
}

.btn-logout:hover {
  background: var(--accent-red);
  color: white;
}

.main-content {
  min-height: calc(100vh - 180px);
  padding-top: 32px;
  padding-bottom: 48px;
}

.footer {
  border-top: 1px solid var(--border-color);
  padding: 24px 0;
  text-align: center;
  color: var(--text-muted);
  font-size: 13px;
}

@keyframes glow-pulse {
  0%, 100% { opacity: 0.7; }
  50% { opacity: 1; }
}
</style>
