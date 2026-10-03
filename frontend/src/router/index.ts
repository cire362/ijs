import { createRouter, createWebHistory, type RouteLocationRaw, type RouteRecordRaw } from 'vue-router'
import type { Role } from '@/api/types'
import { BRAND_NAME } from '@/config/brand'
import { useAuthStore } from '@/stores/auth'

declare module 'vue-router' {
  interface RouteMeta {
    title?: string
    description?: string
    /** public: marketing chrome; app: cabinet chrome; auth: centered forms; auto: cabinet when signed in. */
    layout?: 'public' | 'app' | 'auth' | 'auto'
    requiresAuth?: boolean
    guestOnly?: boolean
    roles?: Role[]
    approvedDeveloper?: boolean
    index?: boolean
  }
}

const routes: RouteRecordRaw[] = [
  { path: '/', component: () => import('@/features/home/HomeView.vue'), meta: { layout: 'public', index: true, title: 'Дома и участки ИЖС от застройщиков', description: 'Каталог домов и участков ИЖС: заявки, бронирование и сопровождение сделки в одном кабинете.' } },
  { path: '/legal', component: () => import('@/features/legal/LegalView.vue'), meta: { layout: 'public', index: true, title: 'Правовые документы' } },
  { path: '/privacy', redirect: { path: '/legal', query: { tab: 'privacy' } } },
  { path: '/terms', redirect: { path: '/legal', query: { tab: 'terms' } } },
  { path: '/news', component: () => import('@/features/news/NewsListView.vue'), meta: { layout: 'auto', index: true, title: 'Новости' } },
  { path: '/news/:id(\\d+)', component: () => import('@/features/news/NewsDetailView.vue'), meta: { layout: 'auto', index: true, title: 'Новость' } },
  { path: '/events', component: () => import('@/features/events/EventsView.vue'), meta: { layout: 'auto', index: true, title: 'Мероприятия' } },

  { path: '/login', component: () => import('@/features/auth/LoginView.vue'), meta: { layout: 'auth', guestOnly: true, title: 'Вход' } },
  { path: '/register', component: () => import('@/features/auth/RegisterView.vue'), meta: { layout: 'auth', guestOnly: true, title: 'Регистрация' } },
  { path: '/forgot-password', component: () => import('@/features/auth/ForgotPasswordView.vue'), meta: { layout: 'auth', guestOnly: true, title: 'Восстановление пароля' } },
  { path: '/reset-password', component: () => import('@/features/auth/ResetPasswordView.vue'), meta: { layout: 'auth', title: 'Новый пароль' } },

  { path: '/properties', component: () => import('@/features/properties/CatalogView.vue'), meta: { layout: 'app', requiresAuth: true, title: 'Объекты' } },
  { path: '/properties/:id(\\d+)', component: () => import('@/features/properties/PropertyView.vue'), meta: { layout: 'app', requiresAuth: true, title: 'Объект' } },
  { path: '/applications', component: () => import('@/features/applications/MyApplicationsView.vue'), meta: { layout: 'app', requiresAuth: true, roles: ['agent', 'individual'], title: 'Мои заявки' } },
  { path: '/incoming', component: () => import('@/features/applications/IncomingView.vue'), meta: { layout: 'app', requiresAuth: true, roles: ['developer', 'admin'], approvedDeveloper: true, title: 'Входящие заявки' } },
  { path: '/application-chats', component: () => import('@/features/chats/ApplicationChatsView.vue'), meta: { layout: 'app', requiresAuth: true, roles: ['agent', 'individual', 'admin'], title: 'Чаты по заявкам' } },
  { path: '/tariffs', component: () => import('@/features/tariffs/TariffsView.vue'), meta: { layout: 'app', requiresAuth: true, roles: ['agent', 'developer', 'admin'], approvedDeveloper: true, title: 'Тарифы' } },
  { path: '/notifications', component: () => import('@/features/notifications/NotificationsView.vue'), meta: { layout: 'app', requiresAuth: true, title: 'Уведомления' } },
  { path: '/profile', component: () => import('@/features/profile/ProfileView.vue'), meta: { layout: 'app', requiresAuth: true, title: 'Профиль' } },

  { path: '/admin/chat', component: () => import('@/features/admin/SupportInboxView.vue'), meta: { layout: 'app', requiresAuth: true, roles: ['admin'], title: 'Поддержка' } },
  { path: '/admin/developers', component: () => import('@/features/admin/DevelopersView.vue'), meta: { layout: 'app', requiresAuth: true, roles: ['admin'], title: 'Застройщики' } },
  { path: '/admin/events', component: () => import('@/features/admin/EventsAdminView.vue'), meta: { layout: 'app', requiresAuth: true, roles: ['admin'], title: 'Управление мероприятиями' } },
  { path: '/admin/audit', component: () => import('@/features/admin/AuditView.vue'), meta: { layout: 'app', requiresAuth: true, roles: ['admin'], title: 'Журнал изменений' } },

  { path: '/:pathMatch(.*)*', component: () => import('@/features/errors/NotFoundView.vue'), meta: { layout: 'auto', title: 'Страница не найдена' } }
]

export function homeFor (role: Role | null | undefined, approved = true): RouteLocationRaw {
  if (role === 'admin') return '/incoming'
  if (role === 'developer') return approved ? '/incoming' : '/profile'
  if (role) return '/properties'
  return '/'
}

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior (to, _from, saved) {
    if (saved) return saved
    if (to.hash && to.hash.startsWith('#') && !to.hash.includes('=')) return { el: to.hash, behavior: 'smooth' }
    return { top: 0 }
  }
})

router.beforeEach((to) => {
  const auth = useAuthStore()
  if (to.meta.guestOnly && auth.user) return homeFor(auth.role, auth.user.developerApproved)
  if (to.meta.requiresAuth && !auth.user) return { path: '/login', query: { redirect: to.fullPath } }
  if (to.meta.roles && (!auth.role || !to.meta.roles.includes(auth.role))) return homeFor(auth.role, auth.user?.developerApproved)
  if (to.meta.approvedDeveloper && auth.isPendingDeveloper) return '/profile'
  return true
})

function setMeta (attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.content = content
}

router.afterEach((to) => {
  const title = to.meta.title ? `${to.meta.title} | ${BRAND_NAME}` : BRAND_NAME
  document.title = title
  setMeta('name', 'robots', to.meta.index ? 'index,follow' : 'noindex,nofollow')
  setMeta('property', 'og:title', title)
  if (to.meta.description) {
    setMeta('name', 'description', to.meta.description)
    setMeta('property', 'og:description', to.meta.description)
  }
})

export default router
