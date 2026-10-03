import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { notificationsApi } from '@/api/endpoints'
import type { AppNotification } from '@/api/types'
import { keepSubscribed, onSocket } from '@/realtime/socket'
import { useAuthStore } from './auth'

export const useNotificationsStore = defineStore('notifications', () => {
  const unread = ref(0)
  const latest = ref<AppNotification[]>([])
  const listeners = new Set<(note: AppNotification) => void>()
  let stop: (() => void)[] = []

  async function refresh () {
    const [count, page] = await Promise.all([
      notificationsApi.unreadCount(),
      notificationsApi.list({ page: 1, limit: 8 })
    ])
    unread.value = count
    latest.value = page.items
  }

  function start (userId: number) {
    stopAll()
    stop = [
      keepSubscribed(`notifications:${userId}`, (socket, token) => socket.emit('subscribe', { userId, token })),
      onSocket<AppNotification>('notification', (note) => {
        if (note.userId !== userId) return
        latest.value = [note, ...latest.value.filter((item) => item.id !== note.id)].slice(0, 8)
        if (!note.isRead) unread.value += 1
        listeners.forEach((fn) => fn(note))
      })
    ]
    void refresh().catch(() => {})
  }

  function stopAll () {
    stop.forEach((fn) => fn())
    stop = []
    unread.value = 0
    latest.value = []
  }

  async function markRead (note: AppNotification) {
    if (note.isRead) return
    await notificationsApi.markRead(note.id)
    note.isRead = true
    latest.value = latest.value.map((item) => item.id === note.id ? { ...item, isRead: true } : item)
    unread.value = Math.max(0, unread.value - 1)
  }

  async function markAllRead () {
    await notificationsApi.markAllRead()
    unread.value = 0
    latest.value = latest.value.map((item) => ({ ...item, isRead: true }))
  }

  /** Lets a page react to new notifications (e.g. reload a list). */
  function onIncoming (fn: (note: AppNotification) => void) {
    listeners.add(fn)
    return () => listeners.delete(fn)
  }

  function init () {
    const auth = useAuthStore()
    watch(() => auth.user?.id, (id) => { if (id) start(id); else stopAll() }, { immediate: true })
  }

  return { unread, latest, refresh, markRead, markAllRead, onIncoming, init }
})
