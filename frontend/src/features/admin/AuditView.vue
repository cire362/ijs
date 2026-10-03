<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { IconHistory } from '@tabler/icons-vue'
import { auditApi } from '@/api/endpoints'
import type { AuditEntry, Page } from '@/api/types'
import { useAsync } from '@/composables/useAsync'
import { formatDateTime, formatPercent, formatPrice } from '@/utils/format'
import PageHeader from '@/components/PageHeader.vue'
import EmptyState from '@/components/EmptyState.vue'
import ErrorState from '@/components/ErrorState.vue'
import SkeletonRows from '@/components/SkeletonRows.vue'

const PAGE_SIZE = 30
const route = useRoute()
const router = useRouter()
const entityType = ref<AuditEntry['entityType'] | ''>((route.query.entityType as AuditEntry['entityType']) || '')
const entityId = ref<number | null>(Number(route.query.entityId) || null)
const page = ref(1)

const { data, loading, error, run } = useAsync(
  () => auditApi.list({ entityType: entityType.value, entityId: entityId.value, page: page.value, limit: PAGE_SIZE }),
  { items: [], total: 0, page: 1, limit: PAGE_SIZE } as Page<AuditEntry>
)
watch([entityType, entityId], () => {
  page.value = 1
  void router.replace({ query: { ...(entityType.value ? { entityType: entityType.value } : {}), ...(entityId.value ? { entityId: String(entityId.value) } : {}) } })
  void run()
})
watch(page, () => run())
void run()

const TYPES: Record<AuditEntry['entityType'], string> = { property: 'Объект', tariff_rate: 'Тариф', application: 'Заявка', user: 'Пользователь' }
const ACTIONS: Record<string, string> = { price_changed: 'Изменена цена', rate_created: 'Создан тариф', rate_changed: 'Изменён тариф', client_changed: 'Изменены данные клиента', account_deleted: 'Аккаунт удалён владельцем' }

function link (entry: AuditEntry) {
  if (entry.entityType === 'property') return `/properties/${entry.entityId}`
  if (entry.entityType === 'application') return { path: '/incoming', query: { app: String(entry.entityId) } }
  return null
}

function describe (values: Record<string, unknown> | null) {
  if (!values) return ''
  const parts: string[] = []
  if ('price' in values) parts.push(`цена ${formatPrice(values.price as string)}`)
  if ('commissionFrom' in values) parts.push(`комиссия от ${formatPercent(values.commissionFrom as string)}`)
  if (values.commissionTo) parts.push(`до ${formatPercent(values.commissionTo as string)}`)
  if ('isActive' in values) parts.push(values.isActive ? 'действует' : 'отключён')
  if ('clientFullName' in values) parts.push(String(values.clientFullName ?? ''))
  if ('clientPhone' in values) parts.push(String(values.clientPhone ?? ''))
  if ('role' in values) parts.push(`роль ${String(values.role)}`)
  return parts.filter(Boolean).join(', ')
}
</script>

<template>
  <div>
    <PageHeader title="Журнал изменений" description="Цены, тарифы, данные клиентов в заявках и удаление аккаунтов: кто, когда и что изменил.">
      <template #actions>
        <el-select v-model="entityType" placeholder="Все записи" clearable class="w-48" aria-label="Тип">
          <el-option v-for="(label, value) in TYPES" :key="value" :value="value" :label="label" />
        </el-select>
        <el-input-number v-model="entityId" :min="1" :controls="false" placeholder="ID записи" class="!w-32" aria-label="ID записи" />
      </template>
    </PageHeader>
    <ErrorState v-if="error" :message="error" @retry="run" />
    <SkeletonRows v-else-if="loading && !data.items.length" :rows="6" height="56px" />
    <EmptyState v-else-if="!data.items.length" :icon="IconHistory" title="Записей нет" />
    <div v-else class="surface overflow-hidden">
      <el-table :data="data.items">
        <el-table-column label="Когда" width="170"><template #default="{ row }"><span class="text-sm text-muted">{{ formatDateTime(row.createdAt) }}</span></template></el-table-column>
        <el-table-column label="Запись" width="170">
          <template #default="{ row }">
            <router-link v-if="link(row as AuditEntry)" :to="link(row as AuditEntry)!" class="link">{{ TYPES[row.entityType as AuditEntry['entityType']] }} №{{ row.entityId }}</router-link>
            <span v-else>{{ TYPES[row.entityType as AuditEntry['entityType']] }} №{{ row.entityId }}</span>
          </template>
        </el-table-column>
        <el-table-column label="Действие" min-width="180"><template #default="{ row }">{{ ACTIONS[row.action] ?? row.action }}</template></el-table-column>
        <el-table-column label="Было" min-width="200"><template #default="{ row }"><span class="text-sm text-muted">{{ describe(row.before) }}</span></template></el-table-column>
        <el-table-column label="Стало" min-width="200"><template #default="{ row }"><span class="text-sm text-ink">{{ describe(row.after) }}</span></template></el-table-column>
        <el-table-column label="Автор" width="110"><template #default="{ row }"><span class="font-mono text-sm text-muted">{{ row.actorId ? `ID ${row.actorId}` : 'система' }}</span></template></el-table-column>
      </el-table>
    </div>
    <el-pagination v-if="data.total > PAGE_SIZE" v-model:current-page="page" class="mt-6 justify-center" layout="prev, pager, next" :page-size="PAGE_SIZE" :total="data.total" background />
  </div>
</template>
