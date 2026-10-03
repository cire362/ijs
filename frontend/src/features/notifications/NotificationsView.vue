<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { IconBellOff, IconChecks, IconSearch } from '@tabler/icons-vue'
import { notificationsApi } from '@/api/endpoints'
import { errorMessage } from '@/api/http'
import type { AppNotification, Page } from '@/api/types'
import { useAsync } from '@/composables/useAsync'
import { useAuthStore } from '@/stores/auth'
import { useNotificationsStore } from '@/stores/notifications'
import { formatDateTime, formatRelative } from '@/utils/format'
import { notificationLink } from '@/utils/notificationLink'
import PageHeader from '@/components/PageHeader.vue'
import EmptyState from '@/components/EmptyState.vue'
import ErrorState from '@/components/ErrorState.vue'
import SkeletonRows from '@/components/SkeletonRows.vue'

const PAGE_SIZE = 20
const auth = useAuthStore()
const store = useNotificationsStore()
const router = useRouter()
const page = ref(1)
const filter = ref<'all' | 'unread'>('all')
const search = ref('')
const marking = ref(false)

const { data, loading, error, run } = useAsync(
  () => notificationsApi.list({ page: page.value, limit: PAGE_SIZE, q: search.value.trim(), isRead: filter.value === 'unread' ? false : null }),
  { items: [], total: 0, page: 1, limit: PAGE_SIZE } as Page<AppNotification>
)
let timer: ReturnType<typeof setTimeout> | undefined
watch([filter, search], () => { clearTimeout(timer); timer = setTimeout(() => { page.value = 1; void run() }, 300) })
watch(page, () => run())
void run()
const stop = store.onIncoming(() => { if (page.value === 1) void run() })
onBeforeUnmount(stop)

async function open (note: AppNotification) {
  await store.markRead(note).catch(() => {})
  note.isRead = true
  const target = notificationLink(note, auth.role)
  if (target) await router.push(target)
}

async function markAll () {
  marking.value = true
  try {
    await store.markAllRead()
    await run()
  } catch (e) {
    ElMessage.error(errorMessage(e))
  } finally {
    marking.value = false
  }
}
</script>

<template>
  <div class="max-w-4xl">
    <PageHeader title="Уведомления" description="Изменения по заявкам, мероприятиям и аккаунту.">
      <template #actions>
        <el-button :loading="marking" :disabled="!store.unread" @click="markAll"><IconChecks :size="18" class="mr-1.5" />Прочитать все</el-button>
      </template>
    </PageHeader>
    <div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
      <div class="inline-flex rounded-control bg-surface-2 p-1" role="tablist">
        <button v-for="option in [{ value: 'all', label: 'Все' }, { value: 'unread', label: `Непрочитанные${store.unread ? ` (${store.unread})` : ''}` }] as const" :key="option.value" type="button" role="tab" :aria-selected="filter === option.value" class="rounded-[8px] px-4 py-1.5 text-sm font-medium" :class="filter === option.value ? 'bg-surface text-ink shadow-soft' : 'text-muted'" @click="filter = option.value">{{ option.label }}</button>
      </div>
      <el-input v-model="search" placeholder="Поиск по тексту" clearable class="sm:max-w-xs" aria-label="Поиск уведомлений">
        <template #prefix><IconSearch :size="16" /></template>
      </el-input>
    </div>

    <ErrorState v-if="error" :message="error" @retry="run" />
    <SkeletonRows v-else-if="loading && !data.items.length" :rows="6" height="64px" />
    <EmptyState v-else-if="!data.items.length" :icon="IconBellOff" :title="filter === 'unread' ? 'Всё прочитано' : 'Уведомлений нет'" />
    <ul v-else class="surface divide-y divide-[var(--border)] overflow-hidden" :class="{ 'opacity-60': loading }">
      <li v-for="note in data.items" :key="note.id">
        <button type="button" class="flex w-full items-start gap-3 px-5 py-4 text-left transition-colors hover:bg-surface-2" @click="open(note)">
          <span class="mt-2 size-2 shrink-0 rounded-full" :class="note.isRead ? 'bg-transparent' : 'bg-accent'" :aria-label="note.isRead ? undefined : 'Не прочитано'" />
          <span class="min-w-0 flex-1">
            <span class="block text-[15px] text-ink" :class="{ 'font-medium': !note.isRead }">{{ note.text }}</span>
            <span class="mt-0.5 block text-xs text-subtle" :title="formatDateTime(note.createdAt)">{{ formatRelative(note.createdAt) }}</span>
          </span>
        </button>
      </li>
    </ul>
    <el-pagination v-if="data.total > PAGE_SIZE" v-model:current-page="page" class="mt-6 justify-center" layout="prev, pager, next" :page-size="PAGE_SIZE" :total="data.total" background />
  </div>
</template>
