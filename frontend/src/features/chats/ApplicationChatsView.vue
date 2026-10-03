<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { IconArrowLeft, IconMessages, IconSearch } from '@tabler/icons-vue'
import { applicationsApi } from '@/api/endpoints'
import type { ApplicationChatMessage, ApplicationChatSummary } from '@/api/types'
import { useAsync } from '@/composables/useAsync'
import { keepSubscribed, onSocket } from '@/realtime/socket'
import { useAuthStore } from '@/stores/auth'
import { formatRelative, personName } from '@/utils/format'
import PageHeader from '@/components/PageHeader.vue'
import EmptyState from '@/components/EmptyState.vue'
import ErrorState from '@/components/ErrorState.vue'
import SkeletonRows from '@/components/SkeletonRows.vue'
import ApplicationChat from './ApplicationChat.vue'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const search = ref('')
const activeId = ref<number | null>(Number(route.query.appId) || null)
const { data: chats, loading, error, run } = useAsync(() => applicationsApi.chats(), [] as ApplicationChatSummary[])
void run()

const sorted = computed(() => {
  const q = search.value.trim().toLowerCase()
  return [...chats.value]
    .filter((chat) => !q || `${chat.title} ${chat.applicationId} ${personName(chat.agent)}`.toLowerCase().includes(q))
    .sort((a, b) => b.lastTime.localeCompare(a.lastTime))
})
const active = computed(() => chats.value.find((chat) => chat.applicationId === activeId.value) ?? null)

watch(activeId, (id) => { void router.replace({ query: id ? { appId: String(id) } : {} }) })

function touch (applicationId: number, message: ApplicationChatMessage) {
  const preview = message.text || (message.attachmentOriginalName ? `Файл: ${message.attachmentOriginalName}` : '')
  chats.value = chats.value.map((chat) => chat.applicationId === applicationId ? { ...chat, lastMessage: preview, lastTime: message.createdAt } : chat)
}

// Administrators follow every application chat to keep the list fresh.
const stops = [
  onSocket<{ applicationId: number, message: ApplicationChatMessage }>('application_chat_message', ({ applicationId, message }) => {
    if (chats.value.some((chat) => chat.applicationId === applicationId)) touch(applicationId, message)
    else void run()
  })
]
if (auth.isAdmin) stops.push(keepSubscribed('application-admins', (socket, token) => socket.emit('application_admin_subscribe', { token })))
onBeforeUnmount(() => stops.forEach((stop) => stop()))
</script>

<template>
  <div>
    <PageHeader title="Чаты по заявкам" :description="auth.isAdmin ? 'Переписка с агентами и покупателями по каждой заявке.' : 'Вопросы по заявкам решаются с администратором платформы.'" />

    <ErrorState v-if="error" :message="error" @retry="run" />
    <SkeletonRows v-else-if="loading && !chats.length" :rows="5" />
    <EmptyState v-else-if="!chats.length" :icon="IconMessages" title="Чатов пока нет" :text="auth.isAdmin ? 'Чат появляется у каждой заявки.' : 'Чат появляется после подачи заявки на объект.'">
      <router-link v-if="!auth.isAdmin" to="/properties"><el-button type="primary">Открыть каталог</el-button></router-link>
    </EmptyState>

    <div v-else class="surface grid h-[calc(100dvh-220px)] min-h-[480px] overflow-hidden md:grid-cols-[320px_1fr]">
      <aside class="flex min-h-0 flex-col border-line md:border-r" :class="{ 'hidden md:flex': activeId }">
        <div class="border-b border-line p-3">
          <el-input v-model="search" placeholder="Объект, номер или агент" clearable aria-label="Поиск чата">
            <template #prefix><IconSearch :size="16" /></template>
          </el-input>
        </div>
        <ul class="flex-1 overflow-y-auto">
          <li v-for="chat in sorted" :key="chat.applicationId">
            <button type="button" class="flex w-full flex-col gap-0.5 border-b border-line px-4 py-3 text-left transition-colors" :class="chat.applicationId === activeId ? 'bg-accent-soft' : 'hover:bg-surface-2'" @click="activeId = chat.applicationId">
              <span class="flex items-baseline justify-between gap-2">
                <span class="truncate font-medium text-ink">{{ chat.title }}</span>
                <span class="shrink-0 text-xs text-subtle">{{ formatRelative(chat.lastTime) }}</span>
              </span>
              <span class="text-xs text-muted">Заявка №{{ chat.applicationId }}<template v-if="auth.isAdmin">, {{ personName(chat.agent, 'агент') }}</template></span>
              <span class="truncate text-sm text-muted">{{ chat.lastMessage || 'Сообщений нет' }}</span>
            </button>
          </li>
          <li v-if="!sorted.length" class="px-4 py-8 text-center text-sm text-muted">Ничего не найдено</li>
        </ul>
      </aside>
      <section class="flex min-h-0 flex-col p-4" :class="{ 'hidden md:flex': !activeId }">
        <template v-if="active">
          <header class="flex items-center gap-3 border-b border-line pb-3">
            <button type="button" class="grid size-8 place-items-center rounded-control text-muted hover:bg-surface-2 md:hidden" aria-label="К списку чатов" @click="activeId = null"><IconArrowLeft :size="18" /></button>
            <div class="min-w-0">
              <h2 class="truncate font-semibold text-ink">{{ active.title }}</h2>
              <router-link :to="{ path: auth.isAdmin ? '/incoming' : '/applications', query: { app: String(active.applicationId) } }" class="link text-sm">Заявка №{{ active.applicationId }}</router-link>
            </div>
          </header>
          <div class="min-h-0 flex-1">
            <ApplicationChat :application-id="active.applicationId" @message="(m) => touch(active!.applicationId, m)" />
          </div>
        </template>
        <div v-else class="grid flex-1 place-items-center text-center text-sm text-muted">Выберите чат слева</div>
      </section>
    </div>
  </div>
</template>
