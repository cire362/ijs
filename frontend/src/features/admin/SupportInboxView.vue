<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { IconArrowLeft, IconCircleCheck, IconLifebuoy, IconRotate, IconSend2 } from '@tabler/icons-vue'
import { supportApi } from '@/api/endpoints'
import { errorMessage, getAccessToken } from '@/api/http'
import type { SupportChatSummary } from '@/api/types'
import { useAsync } from '@/composables/useAsync'
import { getSocket, keepSubscribed, onSocket } from '@/realtime/socket'
import { formatRelative, formatShortDateTime } from '@/utils/format'
import PageHeader from '@/components/PageHeader.vue'
import EmptyState from '@/components/EmptyState.vue'
import ErrorState from '@/components/ErrorState.vue'
import SkeletonRows from '@/components/SkeletonRows.vue'

interface Line { key: string, text: string, fromSupport: boolean, at: string }
interface Incoming { roomId: string, text: string, senderName: string | null, senderEmail: string | null, timestamp: string, movedToNew: boolean }

const tab = ref<'new' | 'resolved'>('new')
const activeRoom = ref<string | null>(null)
const lines = ref<Line[]>([])
const loadingLines = ref(false)
const reply = ref('')
const busy = ref(false)
const list = ref<HTMLElement | null>(null)

const { data: chats, loading, error, run } = useAsync(() => supportApi.chats(), [] as SupportChatSummary[])
void run()

const visible = computed(() => chats.value
  .filter((chat) => tab.value === 'resolved' ? chat.isResolved : !chat.isResolved)
  .sort((a, b) => String(b.lastTime).localeCompare(String(a.lastTime))))
const active = computed(() => chats.value.find((chat) => chat.roomId === activeRoom.value) ?? null)
const unreadTotal = computed(() => chats.value.filter((c) => !c.isResolved).reduce((sum, chat) => sum + chat.unreadCount, 0))

function scrollDown () { void nextTick(() => list.value?.scrollTo({ top: list.value.scrollHeight })) }

watch(activeRoom, async (roomId) => {
  lines.value = []
  if (!roomId) return
  loadingLines.value = true
  try {
    const history = await supportApi.history(roomId)
    lines.value = history.map((m) => ({ key: `h${m.id}`, text: m.text, fromSupport: Boolean(m.isAdmin), at: m.createdAt ?? '' }))
    scrollDown()
    const chat = chats.value.find((c) => c.roomId === roomId)
    if (chat?.unreadCount) {
      await supportApi.markRead(roomId)
      chat.unreadCount = 0
    }
  } catch (e) {
    ElMessage.error(errorMessage(e))
  } finally {
    loadingLines.value = false
  }
})

const stops = [
  keepSubscribed('support-admins', (socket, token) => socket.emit('admin_subscribe', { token })),
  onSocket<Incoming>('new_support_message', (message) => {
    const chat = chats.value.find((c) => c.roomId === message.roomId)
    if (!chat) { void run(); return }
    chat.lastMessage = message.text
    chat.lastTime = message.timestamp
    if (message.movedToNew) chat.isResolved = false
    if (message.roomId === activeRoom.value) {
      lines.value.push({ key: `n${Date.now()}`, text: message.text, fromSupport: false, at: message.timestamp })
      scrollDown()
      void supportApi.markRead(message.roomId).catch(() => {})
    } else {
      chat.unreadCount += 1
    }
  })
]
onBeforeUnmount(() => stops.forEach((stop) => stop()))

function send () {
  const text = reply.value.trim()
  if (!text || !activeRoom.value) return
  getSocket().emit('admin_reply', { roomId: activeRoom.value, text, token: getAccessToken() })
  lines.value.push({ key: `o${Date.now()}`, text, fromSupport: true, at: new Date().toISOString() })
  const chat = active.value
  if (chat) { chat.lastMessage = text; chat.lastTime = new Date().toISOString() }
  reply.value = ''
  scrollDown()
}

async function setResolved (resolved: boolean) {
  if (!active.value) return
  busy.value = true
  try {
    await supportApi.resolve(active.value.roomId, resolved)
    active.value.isResolved = resolved
    ElMessage.success(resolved ? 'Обращение закрыто' : 'Обращение возвращено в работу')
    if (resolved) activeRoom.value = null
  } catch (e) {
    ElMessage.error(errorMessage(e))
  } finally {
    busy.value = false
  }
}

function guestLabel (chat: SupportChatSummary) {
  return chat.roomId.startsWith('guest:') ? 'Гость' : 'Пользователь'
}
</script>

<template>
  <div>
    <PageHeader title="Поддержка" description="Обращения посетителей и пользователей из виджета на сайте." />
    <ErrorState v-if="error" :message="error" @retry="run" />
    <SkeletonRows v-else-if="loading && !chats.length" :rows="5" />
    <EmptyState v-else-if="!chats.length" :icon="IconLifebuoy" title="Обращений пока нет" text="Сообщения из виджета поддержки появятся здесь сразу после отправки." />
    <div v-else class="surface grid h-[calc(100dvh-220px)] min-h-[480px] overflow-hidden md:grid-cols-[340px_1fr]">
      <aside class="flex min-h-0 flex-col md:border-r md:border-line" :class="{ 'hidden md:flex': activeRoom }">
        <div class="border-b border-line p-3">
          <div class="grid grid-cols-2 rounded-control bg-surface-2 p-1" role="tablist">
            <button type="button" role="tab" :aria-selected="tab === 'new'" class="rounded-[8px] py-1.5 text-sm font-medium" :class="tab === 'new' ? 'bg-surface text-ink shadow-soft' : 'text-muted'" @click="tab = 'new'">В работе<span v-if="unreadTotal" class="ml-1.5 rounded-full bg-accent px-1.5 text-xs text-accent-contrast tabular">{{ unreadTotal }}</span></button>
            <button type="button" role="tab" :aria-selected="tab === 'resolved'" class="rounded-[8px] py-1.5 text-sm font-medium" :class="tab === 'resolved' ? 'bg-surface text-ink shadow-soft' : 'text-muted'" @click="tab = 'resolved'">Решённые</button>
          </div>
        </div>
        <ul class="flex-1 overflow-y-auto">
          <li v-for="chat in visible" :key="chat.roomId">
            <button type="button" class="flex w-full flex-col gap-0.5 border-b border-line px-4 py-3 text-left" :class="chat.roomId === activeRoom ? 'bg-accent-soft' : 'hover:bg-surface-2'" @click="activeRoom = chat.roomId">
              <span class="flex items-baseline justify-between gap-2">
                <span class="truncate font-medium text-ink">{{ chat.senderName }}</span>
                <span class="shrink-0 text-xs text-subtle">{{ formatRelative(chat.lastTime) }}</span>
              </span>
              <span class="text-xs text-muted">{{ guestLabel(chat) }}<template v-if="chat.senderEmail">, {{ chat.senderEmail }}</template></span>
              <span class="flex items-center gap-2">
                <span class="truncate text-sm text-muted">{{ chat.lastMessage }}</span>
                <span v-if="chat.unreadCount" class="ml-auto shrink-0 rounded-full bg-accent px-1.5 text-xs leading-5 text-accent-contrast tabular">{{ chat.unreadCount }}</span>
              </span>
            </button>
          </li>
          <li v-if="!visible.length" class="px-4 py-10 text-center text-sm text-muted">{{ tab === 'new' ? 'Открытых обращений нет' : 'Решённых обращений нет' }}</li>
        </ul>
      </aside>
      <section class="flex min-h-0 flex-col p-4" :class="{ 'hidden md:flex': !activeRoom }">
        <template v-if="active">
          <header class="flex items-center gap-3 border-b border-line pb-3">
            <button type="button" class="grid size-8 place-items-center rounded-control text-muted hover:bg-surface-2 md:hidden" aria-label="К списку" @click="activeRoom = null"><IconArrowLeft :size="18" /></button>
            <div class="min-w-0 flex-1">
              <h2 class="truncate font-semibold text-ink">{{ active.senderName }}</h2>
              <p class="truncate text-sm text-muted">{{ active.senderEmail || guestLabel(active) }}</p>
            </div>
            <el-button v-if="!active.isResolved" :loading="busy" @click="setResolved(true)"><IconCircleCheck :size="17" class="mr-1.5" />Решено</el-button>
            <el-button v-else :loading="busy" @click="setResolved(false)"><IconRotate :size="17" class="mr-1.5" />Вернуть в работу</el-button>
          </header>
          <div ref="list" class="flex flex-1 flex-col gap-2 overflow-y-auto py-4">
            <SkeletonRows v-if="loadingLines" :rows="3" height="48px" />
            <div v-for="line in lines" :key="line.key" class="flex flex-col" :class="line.fromSupport ? 'items-end' : 'items-start'">
              <p class="max-w-[80%] whitespace-pre-wrap break-words rounded-surface px-3.5 py-2.5 text-[15px]" :class="line.fromSupport ? 'rounded-br-[4px] bg-accent text-accent-contrast' : 'rounded-bl-[4px] bg-surface-2 text-ink'">{{ line.text }}</p>
              <span class="mt-0.5 text-[11px] text-subtle">{{ formatShortDateTime(line.at) }}</span>
            </div>
          </div>
          <form class="flex items-end gap-2 border-t border-line pt-3" @submit.prevent="send">
            <el-input v-model="reply" type="textarea" :autosize="{ minRows: 1, maxRows: 5 }" resize="none" maxlength="5000" placeholder="Ответ" aria-label="Ответ" @keydown.enter.exact.prevent="send" />
            <el-button type="primary" native-type="submit" :disabled="!reply.trim()" aria-label="Отправить" class="!px-3"><IconSend2 :size="18" /></el-button>
          </form>
        </template>
        <div v-else class="grid flex-1 place-items-center text-sm text-muted">Выберите обращение слева</div>
      </section>
    </div>
  </div>
</template>
