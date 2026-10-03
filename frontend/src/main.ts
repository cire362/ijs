import { createApp } from 'vue'
import { createPinia } from 'pinia'
import '@/styles/main.css'
import App from './App.vue'
import router from './router'
import { useAuthStore } from './stores/auth'
import { useNotificationsStore } from './stores/notifications'
import { useThemeStore } from './stores/theme'
import { vReveal } from './composables/reveal'

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)
app.directive('reveal', vReveal)

useThemeStore(pinia)
const auth = useAuthStore(pinia)

// The session is restored before routing so guards see the real user.
auth.bootstrap().finally(async () => {
  useNotificationsStore(pinia).init()
  app.use(router)
  await router.isReady()
  app.mount('#app')
})
