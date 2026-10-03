<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { IconMessageCircle, IconSend2, IconX } from '@tabler/icons-vue'
import { supportApi } from '@/api/endpoints'
import { errorMessage, getAccessToken } from '@/api/http'
import { useAuthStore } from '@/stores/auth'
import { getSocket, keepSubscribed, onSocket } from '@/realtime/socket'
import { formatShortDateTime } from '@/utils/format'

interface Line { key: string, text: string, fromSupport: boolean, at: string, failed?: boolean }
interface GuestSession { roomId: string, guestToken: string }

const GUEST_KEY = 'chat_guest_session'
const auth = useAuthStore()
const open = ref(false)
const unread = ref(0)
const lines = ref<Line[]>([])
const draft = ref('')
const guestName = ref('')
const guestEmail = ref('')
const loading = ref(false)
const sending = ref(false)
const error = ref('')
const list = ref<HTMLElement | null>(null)
const guest = ref<GuestSession | null>(readGuest())
const loadedRoom = ref<string | null>(null)

const roomId = computed(() => auth.user ? `user:${auth.user.id}` : guest.value?.roomId ?? null)

function readGuest (): GuestSession | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(GUEST_KEY) || 'null')
    return parsed && typeof parsed.roomId === 'string' && typeof parsed.guestToken === 'string' ? parsed : null
  } catch {
    return null
  }
}
function storeGuest (session: GuestSession | null) {
  guest.value = session
  try {
    if (session) localStorage.setItem(GUEST_KEY, JSON.stringify(session))
    else localStorage.removeItem(GUEST_KEY)
  } catch { /* storage may be unavailable */ }
}

async function ensureGuest () {
  if (auth.user) return
  const session = await supportApi.guestSession(guest.value?.roomId, guest.value?.guestToken)
  if (session.guestToken) storeGuest({ roomId: session.roomId, guestToken: session.guestToken })
}

function scrollDown () {
  void nextTick(() => list.value?.scrollTo({ top: list.value.scrollHeight }))
}

async function loadHistory () {
  if (!roomId.value || loadedRoom.value === roomId.value) return
  loading.value = true
  error.value = ''
  try {
    const history = await supportApi.history(roomId.value, auth.user ? null : guest.value?.guestToken)
    lines.value = history.map((m) => ({ key: `h${m.id}`, text: m.text, fromSupport: Boolean(m.isAdmin), at: m.createdAt ?? '' }))
    loadedRoom.value = roomId.value
    scrollDown()
  } catch (e) {
    if (!auth.user) storeGuest(null)
    error.value = errorMessage(e, 'Не удалось загрузить переписку')
  } finally {
    loading.value = false
  }
}

let stopRoom: (() => void) | null = null
function joinRoom () {
  stopRoom?.()
  stopRoom = null
  if (!roomId.value) return
  const room = roomId.value
  stopRoom = keepSubscribed(`support:${room}`, (socket) => socket.emit('join_room', {
    roomId: room,
    token: getAccessToken(),
    guestToken: auth.user ? null : guest.value?.guestToken
  }))
}

const stopEvents = [
  onSocket<{ roomId: string, text: string, timestamp: string }>('chat_message', (message) => {
    if (message.roomId !== roomId.value) return
    lines.value.push({ key: `r${Date.now()}${Math.random()}`, text: message.text, fromSupport: true, at: message.timestamp })
    if (!open.value) unread.value += 1
    scrollDown()
  }),
  onSocket<{ status: 'ok' | 'error', message?: string }>('message_sent', (result) => {
    if (result.status === 'error') {
      const last = [...lines.value].reverse().find((line) => !line.fromSupport)
      if (last) last.failed = true
      error.value = result.message || 'Сообщение не отправлено'
    }
  }),
  onSocket('support_auth_error', () => {
    if (auth.user) return
    storeGuest(null)
    loadedRoom.value = null
    error.value = 'Сессия чата устарела. Отправьте сообщение ещё раз'
  })
]
onBeforeUnmount(() => { stopEvents.forEach((stop) => stop()); stopRoom?.() })

watch(() => auth.user?.id, () => {
  loadedRoom.value = null
  lines.value = []
  joinRoom()
  if (open.value) void loadHistory()
}, { immediate: true })

async function toggle () {
  open.value = !open.value
  if (!open.value) return
  unread.value = 0
  if (!auth.user && guest.value) await loadHistory()
  if (auth.user) await loadHistory()
  scrollDown()
}

async function send () {
  const text = draft.value.trim()
  if (!text || sending.value) return
  sending.value = true
  error.value = ''
  try {
    if (!auth.user && !guest.value) {
      await ensureGuest()
      joinRoom()
      loadedRoom.value = roomId.value
    }
    getSocket().emit('chat_message', {
      roomId: roomId.value,
      text,
      token: getAccessToken(),
      guestToken: auth.user ? null : guest.value?.guestToken,
      senderName: auth.user ? undefined : guestName.value.trim() || undefined,
      senderEmail: auth.user ? undefined : guestEmail.value.trim() || undefined
    })
    lines.value.push({ key: `o${Date.now()}`, text, fromSupport: false, at: new Date().toISOString() })
    draft.value = ''
    scrollDown()
  } catch (e) {
    error.value = errorMessage(e, 'Не удалось отправить сообщение')
  } finally {
    sending.value = false
  }
}
</script>

<template>
  <div class="fixed bottom-4 right-4 z-30 md:bottom-6 md:right-6">
    <transition enter-from-class="opacity-0 translate-y-2 scale-[0.98]" leave-to-class="opacity-0 translate-y-2" enter-active-class="transition duration-200 origin-bottom-right" leave-active-class="transition duration-150">
      <section v-if="open" class="surface mb-3 flex h-[min(560px,calc(100dvh-120px))] w-[min(380px,calc(100vw-32px))] flex-col overflow-hidden shadow-soft" aria-label="Чат поддержки">
        <header class="flex items-center justify-between border-b border-line px-4 py-3">
          <div>
            <h2 class="text-[15px] font-semibold text-ink">Поддержка</h2>
            <p class="text-xs text-muted">Отвечаем в рабочее время</p>
          </div>
          <button type="button" class="grid size-8 place-items-center rounded-control text-muted hover:bg-surface-2" aria-label="Закрыть чат" @click="open = false"><IconX :size="18" /></button>
        </header>
        <div ref="list" class="flex flex-1 flex-col gap-2 overflow-y-auto px-4 py-4">
          <p class="max-w-[85%] self-start rounded-surface rounded-bl-[4px] bg-surface-2 px-3 py-2 text-sm text-ink">Здравствуйте! Чем мы можем вам помочь?</p>
          <div v-if="loading" class="text-center text-xs text-muted">Загружаем переписку</div>
          <div v-for="line in lines" :key="line.key" class="flex flex-col" :class="line.fromSupport ? 'items-start' : 'items-end'">
            <p class="max-w-[85%] whitespace-pre-wrap break-words rounded-surface px-3 py-2 text-sm" :class="line.fromSupport ? 'rounded-bl-[4px] bg-surface-2 text-ink' : 'rounded-br-[4px] bg-accent text-accent-contrast'">{{ line.text }}</p>
            <span class="mt-0.5 text-[11px] text-subtle">{{ line.failed ? 'Не отправлено' : formatShortDateTime(line.at) }}</span>
          </div>
        </div>
        <form class="border-t border-line p-3" @submit.prevent="send">
          <div v-if="!auth.user && !guest" class="mb-2 grid grid-cols-2 gap-2">
            <el-input v-model="guestName" maxlength="255" placeholder="Имя" aria-label="Ваше имя" />
            <el-input v-model="guestEmail" maxlength="255" type="email" placeholder="Email для ответа" aria-label="Email для ответа" />
          </div>
          <p v-if="error" class="mb-2 text-xs text-danger" role="alert">{{ error }}</p>
          <div class="flex items-end gap-2">
            <el-input v-model="draft" type="textarea" :autosize="{ minRows: 1, maxRows: 4 }" maxlength="5000" resize="none" placeholder="Напишите сообщение" aria-label="Сообщение" @keydown.enter.exact.prevent="send" />
            <el-button type="primary" native-type="submit" :loading="sending" :disabled="!draft.trim()" aria-label="Отправить" class="!px-3"><IconSend2 :size="18" /></el-button>
          </div>
        </form>
      </section>
    </transition>
    <div class="flex justify-end">
      <button type="button" class="press relative inline-flex h-12 items-center gap-2 rounded-full bg-accent px-5 font-medium text-accent-contrast shadow-soft transition-colors hover:bg-accent-hover" :aria-expanded="open" @click="toggle">
        <IconX v-if="open" :size="20" />
        <IconMessageCircle v-else :size="20" />
        <span class="hidden sm:inline">{{ open ? 'Свернуть' : 'Поддержка' }}</span>
        <span v-if="unread && !open" class="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-danger px-1 text-[11px] font-semibold leading-5 text-surface tabular">{{ unread }}</span>
      </button>
    </div>
  </div>
</template>
