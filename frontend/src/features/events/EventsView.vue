<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { IconCalendarEvent, IconMapPin, IconSchool, IconSearch, IconUsers } from '@tabler/icons-vue'
import { eventsApi } from '@/api/endpoints'
import { errorMessage } from '@/api/http'
import type { EventRegistration, Page, PlatformEvent } from '@/api/types'
import { useAsync } from '@/composables/useAsync'
import { confirmAction } from '@/composables/confirm'
import { useAuthStore } from '@/stores/auth'
import { useNotificationsStore } from '@/stores/notifications'
import { formatDateTime } from '@/utils/format'
import { EVENT_FORMAT, REGISTRATION_STATUS } from '@/utils/status'
import PageHeader from '@/components/PageHeader.vue'
import EmptyState from '@/components/EmptyState.vue'
import ErrorState from '@/components/ErrorState.vue'
import SkeletonRows from '@/components/SkeletonRows.vue'
import StatusTag from '@/components/StatusTag.vue'
import EventDate from '@/components/event/EventDate.vue'

const PAGE_SIZE = 12
const auth = useAuthStore()
const period = ref<'upcoming' | 'past'>('upcoming')
const search = ref('')
const trainingOnly = ref(false)
const page = ref(1)
const busyId = ref<number | null>(null)
const registrations = ref(new Map<number, EventRegistration>())

const { data, loading, error, run } = useAsync(
  () => eventsApi.list({ page: page.value, limit: PAGE_SIZE, period: period.value, q: search.value.trim(), training: trainingOnly.value || undefined }),
  { items: [], total: 0, page: 1, limit: PAGE_SIZE } as Page<PlatformEvent>
)

async function loadMine () {
  if (!auth.isApplicant) return
  const mine = await eventsApi.mine({ page: 1, limit: 50 }).catch(() => null)
  if (mine) registrations.value = new Map(mine.items.map((item) => [item.eventId, item]))
}

let timer: ReturnType<typeof setTimeout> | undefined
watch([search, trainingOnly, period], () => {
  clearTimeout(timer)
  timer = setTimeout(() => { page.value = 1; void run() }, 300)
})
watch(page, () => run())
void run()
void loadMine()

const stop = useNotificationsStore().onIncoming((note) => {
  if (note.type.startsWith('event_')) { void run(); void loadMine() }
})
onBeforeUnmount(stop)

const upcoming = computed(() => period.value === 'upcoming')

function placesLeft (event: PlatformEvent) {
  return event.capacity == null ? null : event.capacity
}

async function register (event: PlatformEvent) {
  busyId.value = event.id
  try {
    const registration = await eventsApi.register(event.id)
    registrations.value = new Map(registrations.value).set(event.id, { ...registration, event })
    ElMessage.success('Заявка на участие отправлена')
  } catch (e) {
    ElMessage.error(errorMessage(e))
  } finally {
    busyId.value = null
  }
}

async function unregister (event: PlatformEvent) {
  if (!(await confirmAction('Отменить запись?', `Место на «${event.title}» освободится для других участников.`, 'Отменить запись', true))) return
  busyId.value = event.id
  try {
    await eventsApi.unregister(event.id)
    const next = new Map(registrations.value)
    next.delete(event.id)
    registrations.value = next
    ElMessage.success('Запись отменена')
  } catch (e) {
    ElMessage.error(errorMessage(e))
  } finally {
    busyId.value = null
  }
}
</script>

<template>
  <div :class="{ 'mx-auto max-w-5xl px-4 py-10 md:px-8': !auth.user }">
    <PageHeader title="Мероприятия" description="Вебинары, обучение и встречи для агентов и покупателей.">
      <template v-if="auth.isAdmin" #actions>
        <router-link to="/admin/events"><el-button type="primary">Управление</el-button></router-link>
      </template>
    </PageHeader>

    <div class="mb-5 flex flex-col gap-3 md:flex-row md:items-center">
      <div class="inline-flex rounded-control bg-surface-2 p-1" role="tablist">
        <button v-for="option in [{ value: 'upcoming', label: 'Предстоящие' }, { value: 'past', label: 'Прошедшие' }] as const" :key="option.value" type="button" role="tab" :aria-selected="period === option.value" class="rounded-[8px] px-4 py-1.5 text-sm font-medium" :class="period === option.value ? 'bg-surface text-ink shadow-soft' : 'text-muted'" @click="period = option.value">{{ option.label }}</button>
      </div>
      <el-input v-model="search" placeholder="Название, место или описание" clearable class="md:max-w-sm" aria-label="Поиск мероприятий">
        <template #prefix><IconSearch :size="16" /></template>
      </el-input>
      <el-checkbox v-model="trainingOnly">Только обучение</el-checkbox>
    </div>

    <ErrorState v-if="error" :message="error" @retry="run" />
    <SkeletonRows v-else-if="loading && !data.items.length" :rows="4" height="120px" />
    <EmptyState v-else-if="!data.items.length" :icon="IconCalendarEvent" :title="upcoming ? 'Ближайших мероприятий нет' : 'Прошедших мероприятий нет'" text="Анонсы появляются здесь, а участникам приходит напоминание за час до начала." />
    <ul v-else class="flex flex-col gap-4" :class="{ 'opacity-60': loading }">
      <li v-for="event in data.items" :key="event.id" class="surface flex flex-col gap-4 p-5 sm:flex-row" :class="{ 'opacity-75': event.cancelledAt }">
        <img v-if="event.coverImageUrl" :src="event.coverImageUrl" alt="" loading="lazy" class="aspect-[16/9] w-full rounded-control object-cover sm:aspect-square sm:w-28">
        <EventDate v-else :start-at="event.startAt" />
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-2">
            <h2 class="text-lg font-semibold text-ink">{{ event.title }}</h2>
            <StatusTag v-if="event.cancelledAt" tone="danger" label="Отменено" />
            <StatusTag v-else-if="event.isTraining" tone="accent" label="Обучение" />
          </div>
          <p class="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
            <span>{{ formatDateTime(event.startAt) }}<template v-if="event.endAt"> до {{ new Date(event.endAt).toLocaleTimeString('ru-RU', { timeZone: 'Europe/Moscow', hour: '2-digit', minute: '2-digit' }) }}</template></span>
            <span v-if="event.format" class="inline-flex items-center gap-1"><IconSchool :size="15" />{{ EVENT_FORMAT[event.format] }}</span>
            <span v-if="event.location" class="inline-flex items-center gap-1"><IconMapPin :size="15" />{{ event.location }}</span>
            <span v-if="placesLeft(event) != null" class="inline-flex items-center gap-1"><IconUsers :size="15" />{{ event.capacity }} мест</span>
          </p>
          <p v-if="event.cancelledAt && event.cancelReason" class="mt-2 text-sm text-danger">Причина отмены: {{ event.cancelReason }}</p>
          <p v-if="event.description" class="mt-2 line-clamp-3 whitespace-pre-line text-[15px] text-ink">{{ event.description }}</p>
        </div>
        <div v-if="auth.isApplicant && upcoming && !event.cancelledAt" class="flex shrink-0 flex-col items-start gap-2 sm:items-end">
          <template v-if="registrations.get(event.id)">
            <StatusTag :tone="REGISTRATION_STATUS[registrations.get(event.id)!.status].tone" :label="REGISTRATION_STATUS[registrations.get(event.id)!.status].label" />
            <el-button size="small" text :loading="busyId === event.id" @click="unregister(event)">Отменить запись</el-button>
          </template>
          <el-button v-else type="primary" :loading="busyId === event.id" @click="register(event)">Записаться</el-button>
        </div>
        <router-link v-else-if="!auth.user && upcoming && !event.cancelledAt" to="/login" class="shrink-0"><el-button>Войти, чтобы записаться</el-button></router-link>
      </li>
    </ul>
    <el-pagination v-if="data.total > PAGE_SIZE" v-model:current-page="page" class="mt-6 justify-center" layout="prev, pager, next" :page-size="PAGE_SIZE" :total="data.total" background />
  </div>
</template>
