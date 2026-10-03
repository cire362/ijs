<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { IconArrowUpRight, IconClockHour4, IconMessages, IconUser } from '@tabler/icons-vue'
import { applicationsApi } from '@/api/endpoints'
import { errorMessage } from '@/api/http'
import type { Application, ApplicationStatus } from '@/api/types'
import { promptText } from '@/composables/confirm'
import { useAuthStore } from '@/stores/auth'
import { formatDate, formatDateTime, formatPercent, formatPhone, formatPrice, isValidRuPhone, personName } from '@/utils/format'
import { APPLICATION_STATUS, TERMINAL_STATUSES, isCustomComment, nextManagerStatuses } from '@/utils/status'
import StatusTag from '@/components/StatusTag.vue'
import ApplicationChat from '@/features/chats/ApplicationChat.vue'
import DeadlineBadge from './DeadlineBadge.vue'

const props = defineProps<{ application: Application | null }>()
const open = defineModel<boolean>({ required: true })
const emit = defineEmits<{ changed: [application?: Application] }>()

const auth = useAuthStore()
const tab = ref<'details' | 'chat'>('details')
const busy = ref(false)
const statusForm = reactive({ status: '' as ApplicationStatus | '', comment: '' })
const extendDays = ref(7)
const clientEdit = ref(false)
const client = reactive({ fullName: '', phone: '' })

const app = computed(() => props.application)
const isAuthor = computed(() => Boolean(app.value && app.value.agentId === auth.user?.id))
const isManager = computed(() => auth.isAdmin || (auth.isDeveloper && !auth.isPendingDeveloper))
const terminal = computed(() => Boolean(app.value && TERMINAL_STATUSES.includes(app.value.status)))
const nextStatuses = computed(() => app.value ? nextManagerStatuses(app.value.status) : [])
const canChat = computed(() => auth.isAdmin || isAuthor.value)
const canEditClient = computed(() => isAuthor.value && auth.role === 'agent' && app.value?.status === 'sent')
const history = computed(() => [...(app.value?.history ?? [])].sort((a, b) => a.createdAt.localeCompare(b.createdAt)))

watch(() => props.application?.id, () => {
  tab.value = 'details'
  statusForm.status = ''
  statusForm.comment = ''
  extendDays.value = 7
  clientEdit.value = false
})

async function act<T> (task: () => Promise<T>, success: string) {
  busy.value = true
  try {
    const result = await task()
    ElMessage.success(success)
    emit('changed', result as Application)
    return true
  } catch (e) {
    ElMessage.error(errorMessage(e))
    emit('changed')
    return false
  } finally {
    busy.value = false
  }
}

async function changeStatus () {
  if (!app.value || !statusForm.status) return
  const ok = await act(() => applicationsApi.setStatus(app.value!.id, statusForm.status as ApplicationStatus, statusForm.comment.trim()), `Статус: ${APPLICATION_STATUS[statusForm.status as ApplicationStatus].label.toLowerCase()}`)
  if (ok) { statusForm.status = ''; statusForm.comment = '' }
}

async function extend () {
  if (!app.value) return
  await act(() => applicationsApi.extend(app.value!.id, extendDays.value), `Срок продлён на ${extendDays.value} дн.`)
}

async function cancel () {
  if (!app.value) return
  const comment = await promptText('Отозвать заявку?', 'Застройщик получит уведомление. Если объект был забронирован по этой заявке, бронь снимется. Комментарий необязателен.', 'Отозвать', 'Причина')
  if (comment === null) return
  await act(() => applicationsApi.cancel(app.value!.id, comment), 'Заявка отозвана')
}

function startClientEdit () {
  client.fullName = app.value?.clientFullName ?? ''
  client.phone = app.value?.clientPhone ?? ''
  clientEdit.value = true
}

async function saveClient () {
  if (!app.value) return
  if (!client.fullName.trim()) { ElMessage.error('Укажите ФИО клиента'); return }
  if (!isValidRuPhone(client.phone)) { ElMessage.error('Укажите корректный телефон'); return }
  const ok = await act(() => applicationsApi.updateClient(app.value!.id, client.fullName.trim(), formatPhone(client.phone)), 'Данные клиента обновлены')
  if (ok) clientEdit.value = false
}
</script>

<template>
  <el-drawer v-model="open" :size="'min(640px, 100vw)'" :with-header="false" destroy-on-close>
    <div v-if="app" class="flex h-full flex-col">
      <header class="border-b border-line px-6 pb-4 pt-5">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="text-sm text-muted tabular">Заявка №{{ app.id }} от {{ formatDate(app.createdAt) }}</p>
            <h2 class="mt-1 truncate text-xl font-semibold text-ink">{{ app.property?.title ?? `Объект №${app.propertyId}` }}</h2>
          </div>
          <StatusTag :tone="APPLICATION_STATUS[app.status].tone" :label="APPLICATION_STATUS[app.status].label" />
        </div>
        <div class="mt-4 inline-flex rounded-control bg-surface-2 p-1" role="tablist">
          <button type="button" role="tab" :aria-selected="tab === 'details'" class="rounded-[8px] px-3.5 py-1.5 text-sm font-medium" :class="tab === 'details' ? 'bg-surface text-ink shadow-soft' : 'text-muted'" @click="tab = 'details'">Детали</button>
          <button v-if="canChat" type="button" role="tab" :aria-selected="tab === 'chat'" class="inline-flex items-center gap-1.5 rounded-[8px] px-3.5 py-1.5 text-sm font-medium" :class="tab === 'chat' ? 'bg-surface text-ink shadow-soft' : 'text-muted'" @click="tab = 'chat'"><IconMessages :size="16" />Чат</button>
        </div>
      </header>

      <div v-if="tab === 'chat'" class="min-h-0 flex-1 px-6 pb-5">
        <ApplicationChat :application-id="app.id" />
      </div>

      <div v-else class="flex-1 overflow-y-auto px-6 py-5">
        <DeadlineBadge v-if="app.status === 'sent'" :expires-at="app.expiresAt" class="mb-5" />

        <section class="grid gap-3 sm:grid-cols-2">
          <div class="rounded-control bg-surface-2 p-4">
            <p class="flex items-center gap-1.5 text-xs text-muted"><IconUser :size="15" />Клиент</p>
            <template v-if="!clientEdit">
              <p class="mt-1 font-medium text-ink">{{ app.clientFullName || 'Не указан' }}</p>
              <p class="text-sm text-muted tabular">{{ app.clientPhone || 'Телефон не указан' }}</p>
              <button v-if="canEditClient" type="button" class="link mt-2 text-sm" @click="startClientEdit">Изменить</button>
            </template>
            <form v-else class="mt-2 flex flex-col gap-2" @submit.prevent="saveClient">
              <el-input v-model="client.fullName" maxlength="200" placeholder="ФИО клиента" aria-label="ФИО клиента" />
              <el-input v-model="client.phone" type="tel" maxlength="50" placeholder="+7 900 100-00-11" aria-label="Телефон клиента" />
              <div class="flex gap-2">
                <el-button size="small" type="primary" native-type="submit" :loading="busy">Сохранить</el-button>
                <el-button size="small" @click="clientEdit = false">Отмена</el-button>
              </div>
            </form>
          </div>
          <div class="rounded-control bg-surface-2 p-4">
            <p class="text-xs text-muted">{{ isAuthor ? 'Застройщик' : 'Автор заявки' }}</p>
            <template v-if="isAuthor">
              <p class="mt-1 font-medium text-ink">{{ app.property?.developer?.companyName || personName(app.property?.developer, 'Застройщик') }}</p>
            </template>
            <template v-else>
              <p class="mt-1 font-medium text-ink">{{ personName(app.agent, 'Агент') }}</p>
              <p class="text-sm text-muted">{{ app.agent?.phone || app.agent?.email }}</p>
            </template>
          </div>
        </section>

        <section class="mt-3 rounded-control bg-surface-2 p-4">
          <p class="text-xs text-muted">Комиссия</p>
          <template v-if="app.commissionAmount">
            <p class="mt-1 text-lg font-semibold text-ink tabular">{{ formatPrice(app.commissionAmount, true) }}</p>
            <p class="text-sm text-muted">{{ formatPercent(app.commissionRatePercent) }} от {{ formatPrice(app.commissionBasePrice) }}, зафиксировано при подаче</p>
          </template>
          <p v-else class="mt-1 text-sm text-muted">Не рассчитана: на момент подачи у объекта не было цены или тарифа.</p>
        </section>

        <p v-if="app.comment" class="mt-3 rounded-control border border-line p-4 text-sm text-ink"><span class="mb-1 block text-xs text-muted">Комментарий к заявке</span>{{ app.comment }}</p>

        <router-link :to="`/properties/${app.propertyId}`" class="link mt-4 inline-flex items-center gap-1 text-sm font-medium">Открыть объект <IconArrowUpRight :size="16" /></router-link>

        <!-- Manager actions -->
        <section v-if="isManager && !terminal" class="mt-6 border-t border-line pt-5">
          <h3 class="mb-3 font-semibold text-ink">Сменить статус</h3>
          <div class="flex flex-col gap-2 sm:flex-row">
            <el-select v-model="statusForm.status" placeholder="Новый статус" class="sm:w-64">
              <el-option v-for="status in nextStatuses" :key="status" :value="status" :label="APPLICATION_STATUS[status].label" />
            </el-select>
            <el-input v-model="statusForm.comment" maxlength="500" placeholder="Комментарий (необязательно)" />
          </div>
          <el-button class="mt-2" type="primary" :disabled="!statusForm.status" :loading="busy" @click="changeStatus">Применить</el-button>
          <p class="mt-2 text-xs text-subtle">Подтверждение бронирует объект. Завершение продаёт его и отклоняет остальные отправленные заявки.</p>

          <template v-if="app.status === 'sent'">
            <h3 class="mb-3 mt-6 flex items-center gap-1.5 font-semibold text-ink"><IconClockHour4 :size="18" />Продлить срок</h3>
            <div class="flex gap-2">
              <el-select v-model="extendDays" class="w-36">
                <el-option v-for="days in [3, 7, 14, 30, 60]" :key="days" :value="days" :label="`на ${days} дн.`" />
              </el-select>
              <el-button :loading="busy" @click="extend">Продлить</el-button>
            </div>
          </template>
        </section>

        <!-- Author actions -->
        <section v-if="isAuthor && !terminal" class="mt-6 border-t border-line pt-5">
          <el-button type="danger" plain :loading="busy" @click="cancel">Отозвать заявку</el-button>
          <p class="mt-2 text-xs text-subtle">После отзыва заявку нельзя вернуть, клиент освобождается для других заявок.</p>
        </section>

        <section class="mt-6 border-t border-line pt-5">
          <h3 class="mb-3 font-semibold text-ink">История</h3>
          <ol class="relative ml-2 border-l border-line">
            <li v-for="entry in history" :key="entry.id" class="relative pb-4 pl-5 last:pb-0">
              <span class="absolute -left-[5px] top-1.5 size-2.5 rounded-full bg-accent" aria-hidden="true" />
              <p class="text-sm font-medium text-ink">{{ APPLICATION_STATUS[entry.status]?.label ?? entry.status }}</p>
              <p class="text-xs text-muted">{{ formatDateTime(entry.createdAt) }}<template v-if="entry.actor">, {{ personName(entry.actor) }}</template><template v-else-if="!entry.changedBy">, автоматически</template></p>
              <p v-if="isCustomComment(entry.comment)" class="mt-1 text-sm text-ink">{{ entry.comment }}</p>
            </li>
          </ol>
        </section>
      </div>
    </div>
  </el-drawer>
</template>
