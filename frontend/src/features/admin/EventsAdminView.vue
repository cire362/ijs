<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { IconBan, IconCalendarEvent, IconEdit, IconPlus } from '@tabler/icons-vue'
import { eventsApi } from '@/api/endpoints'
import { errorMessage } from '@/api/http'
import type { EventRegistration, Page, PlatformEvent } from '@/api/types'
import { useAsync } from '@/composables/useAsync'
import { promptText } from '@/composables/confirm'
import { formatDateTime, personName } from '@/utils/format'
import { EVENT_FORMAT, REGISTRATION_STATUS } from '@/utils/status'
import PageHeader from '@/components/PageHeader.vue'
import EmptyState from '@/components/EmptyState.vue'
import ErrorState from '@/components/ErrorState.vue'
import SkeletonRows from '@/components/SkeletonRows.vue'
import StatusTag from '@/components/StatusTag.vue'
import EventFormDialog from './EventFormDialog.vue'

const PAGE_SIZE = 20
const route = useRoute()
const router = useRouter()
const period = ref<'upcoming' | 'past'>('upcoming')
const page = ref(1)
const selectedId = ref<number | null>(Number(route.query.event) || null)
const editing = ref<PlatformEvent | null>(null)
const formOpen = ref(false)
const busy = ref(false)

const events = useAsync(() => eventsApi.list({ page: page.value, limit: PAGE_SIZE, period: period.value }), { items: [], total: 0, page: 1, limit: PAGE_SIZE } as Page<PlatformEvent>)
const registrations = useAsync(() => eventsApi.registrations({ eventId: selectedId.value, page: 1, limit: 200 }), { items: [], total: 0, page: 1, limit: 200 } as Page<EventRegistration>)

watch([period, page], () => events.run(), { immediate: true })
watch(period, () => { page.value = 1 })
watch(selectedId, (id) => {
  void router.replace({ query: id ? { event: String(id) } : {} })
  if (id) void registrations.run()
}, { immediate: true })

const selected = computed(() => events.data.value.items.find((event) => event.id === selectedId.value) ?? registrations.data.value.items[0]?.event ?? null)
const occupied = computed(() => registrations.data.value.items.filter((item) => item.status !== 'rejected').length)

function create () { editing.value = null; formOpen.value = true }
function edit (event: PlatformEvent) { editing.value = event; formOpen.value = true }

async function cancel (event: PlatformEvent) {
  const reason = await promptText('Отменить мероприятие?', 'Все записанные участники получат уведомление, напоминания отключатся. Причину увидят участники.', 'Отменить мероприятие', 'Причина отмены')
  if (reason === null) return
  busy.value = true
  try {
    await eventsApi.cancel(event.id, reason)
    ElMessage.success('Мероприятие отменено')
    await events.run()
  } catch (e) {
    ElMessage.error(errorMessage(e))
  } finally {
    busy.value = false
  }
}

async function decide (registration: EventRegistration, status: 'approved' | 'rejected') {
  busy.value = true
  try {
    await eventsApi.setRegistrationStatus(registration.id, status)
    ElMessage.success(status === 'approved' ? 'Участие подтверждено' : 'Заявка отклонена')
    await registrations.run()
  } catch (e) {
    ElMessage.error(errorMessage(e))
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div>
    <PageHeader title="Мероприятия" description="Анонсы, перенос и отмена, заявки участников.">
      <template #actions>
        <router-link to="/events"><el-button>Как видят участники</el-button></router-link>
        <el-button type="primary" @click="create"><IconPlus :size="18" class="mr-1.5" />Новое мероприятие</el-button>
      </template>
    </PageHeader>

    <div class="grid items-start gap-6 xl:grid-cols-[1.1fr_1fr]">
      <section>
        <div class="mb-4 inline-flex rounded-control bg-surface-2 p-1" role="tablist">
          <button v-for="option in [{ value: 'upcoming', label: 'Предстоящие' }, { value: 'past', label: 'Прошедшие' }] as const" :key="option.value" type="button" role="tab" :aria-selected="period === option.value" class="rounded-[8px] px-4 py-1.5 text-sm font-medium" :class="period === option.value ? 'bg-surface text-ink shadow-soft' : 'text-muted'" @click="period = option.value">{{ option.label }}</button>
        </div>
        <ErrorState v-if="events.error.value" :message="events.error.value" @retry="events.run" />
        <SkeletonRows v-else-if="events.loading.value && !events.data.value.items.length" :rows="4" height="88px" />
        <EmptyState v-else-if="!events.data.value.items.length" :icon="IconCalendarEvent" title="Мероприятий нет" text="Создайте анонс: агенты смогут записаться и получат напоминание за час до начала.">
          <el-button type="primary" @click="create">Новое мероприятие</el-button>
        </EmptyState>
        <ul v-else class="flex flex-col gap-3">
          <li v-for="event in events.data.value.items" :key="event.id">
            <div class="surface flex gap-4 p-4 transition-colors" :class="event.id === selectedId ? 'border-accent' : ''">
              <button type="button" class="min-w-0 flex-1 text-left" @click="selectedId = event.id">
                <span class="flex flex-wrap items-center gap-2">
                  <span class="font-semibold text-ink">{{ event.title }}</span>
                  <StatusTag v-if="event.cancelledAt" tone="danger" label="Отменено" />
                </span>
                <span class="mt-1 block text-sm text-muted">{{ formatDateTime(event.startAt) }}<template v-if="event.format">, {{ EVENT_FORMAT[event.format].toLowerCase() }}</template><template v-if="event.capacity">, {{ event.capacity }} мест</template></span>
              </button>
              <div v-if="!event.cancelledAt" class="flex shrink-0 items-start gap-1">
                <el-tooltip content="Изменить"><el-button text :disabled="busy" aria-label="Изменить" @click="edit(event)"><IconEdit :size="18" /></el-button></el-tooltip>
                <el-tooltip v-if="period === 'upcoming'" content="Отменить"><el-button text type="danger" :disabled="busy" aria-label="Отменить мероприятие" @click="cancel(event)"><IconBan :size="18" /></el-button></el-tooltip>
              </div>
            </div>
          </li>
        </ul>
        <el-pagination v-if="events.data.value.total > PAGE_SIZE" v-model:current-page="page" class="mt-4 justify-center" layout="prev, pager, next" :page-size="PAGE_SIZE" :total="events.data.value.total" background />
      </section>

      <section class="surface p-5 xl:sticky xl:top-24">
        <template v-if="selectedId">
          <h2 class="font-semibold text-ink">Участники</h2>
          <p class="mt-0.5 text-sm text-muted">{{ selected?.title }}<template v-if="selected?.capacity">, занято {{ occupied }} из {{ selected.capacity }}</template></p>
          <SkeletonRows v-if="registrations.loading.value && !registrations.data.value.items.length" class="mt-4" :rows="3" height="48px" />
          <p v-else-if="!registrations.data.value.items.length" class="py-10 text-center text-sm text-muted">Записей пока нет</p>
          <ul v-else class="mt-4 flex flex-col">
            <li v-for="registration in registrations.data.value.items" :key="registration.id" class="flex flex-wrap items-center gap-3 border-t border-line py-3 first:border-t-0">
              <div class="min-w-0 flex-1">
                <p class="font-medium text-ink">{{ personName(registration.agent, 'Участник') }}</p>
                <p class="text-xs text-muted">{{ registration.agent?.email }}, записан {{ formatDateTime(registration.createdAt) }}</p>
              </div>
              <StatusTag :tone="REGISTRATION_STATUS[registration.status].tone" :label="REGISTRATION_STATUS[registration.status].label" />
              <div v-if="!selected?.cancelledAt" class="flex gap-1">
                <el-button v-if="registration.status !== 'approved'" size="small" type="primary" plain :disabled="busy" @click="decide(registration, 'approved')">Подтвердить</el-button>
                <el-button v-if="registration.status !== 'rejected'" size="small" :disabled="busy" @click="decide(registration, 'rejected')">Отклонить</el-button>
              </div>
            </li>
          </ul>
        </template>
        <p v-else class="py-12 text-center text-sm text-muted">Выберите мероприятие, чтобы увидеть участников</p>
      </section>
    </div>

    <EventFormDialog v-model="formOpen" :event="editing" @saved="() => events.run()" />
  </div>
</template>
