import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { authApi, usersApi, type RegisterPayload } from '@/api/endpoints'
import { onSessionLost, onSessionRefreshed, refreshSession, setAccessToken } from '@/api/http'
import type { Role, User } from '@/api/types'
import { resetSocket } from '@/realtime/socket'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const ready = ref(false)

  const role = computed<Role | null>(() => user.value?.role ?? null)
  const isAdmin = computed(() => role.value === 'admin')
  const isDeveloper = computed(() => role.value === 'developer')
  const isApplicant = computed(() => role.value === 'agent' || role.value === 'individual')
  const isPendingDeveloper = computed(() => isDeveloper.value && !user.value?.developerApproved)

  function apply (token: string | null, next: User | null) {
    setAccessToken(token)
    user.value = next
  }

  onSessionRefreshed(({ user: next }) => { user.value = next })
  onSessionLost(() => {
    apply(null, null)
    resetSocket()
  })

  // Restores the session from the HttpOnly refresh cookie; no tokens are kept in storage.
  async function bootstrap () {
    try {
      const { token, user: next } = await refreshSession()
      apply(token, next)
    } catch {
      apply(null, null)
    } finally {
      ready.value = true
    }
  }

  async function login (email: string, password: string) {
    const { token, user: next } = await authApi.login(email, password)
    resetSocket()
    apply(token, next)
  }

  async function register (payload: RegisterPayload) {
    await authApi.register(payload)
    await login(payload.email, payload.password)
  }

  function clearLocal () {
    apply(null, null)
    try {
      localStorage.removeItem('chat_guest_session')
      localStorage.removeItem('chat_guest_room')
    } catch { /* storage may be unavailable */ }
    resetSocket()
  }

  async function logout (everywhere = false) {
    try {
      await (everywhere ? authApi.logoutAll() : authApi.logout())
    } finally {
      clearLocal()
    }
  }

  async function reload () {
    user.value = await usersApi.me()
  }

  function setUser (next: User) {
    user.value = next
  }

  return { user, ready, role, isAdmin, isDeveloper, isApplicant, isPendingDeveloper, bootstrap, login, register, logout, clearLocal, reload, setUser }
})
