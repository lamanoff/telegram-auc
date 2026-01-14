import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('../views/Home.vue')
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/Login.vue')
    },
    {
      path: '/register',
      name: 'register',
      component: () => import('../views/Register.vue')
    },
    {
      path: '/auctions',
      name: 'auctions',
      component: () => import('../views/Auctions.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/auctions/:id',
      name: 'auction-detail',
      component: () => import('../views/AuctionDetail.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/profile',
      name: 'profile',
      component: () => import('../views/Profile.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/admin',
      name: 'admin',
      component: () => import('../views/Admin.vue'),
      meta: { requiresAuth: true, requiresAdmin: true }
    }
  ]
})

router.beforeEach(async (to, from, next) => {
  const authStore = useAuthStore()
  
  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    next({ name: 'login' })
    return
  }
  
  // Для админских маршрутов ждём загрузки профиля
  if (to.meta.requiresAdmin) {
    if (!authStore.user && authStore.isAuthenticated) {
      await authStore.fetchProfile()
    }
    if (authStore.user?.role !== 'admin') {
      next({ name: 'home' })
      return
    }
  }
  
  next()
})

export default router
