<script setup lang="ts">
import type { Application } from '@/api/types'
import { formatDate, formatPrice, personName } from '@/utils/format'
import { APPLICATION_STATUS } from '@/utils/status'
import StatusTag from '@/components/StatusTag.vue'
import DeadlineBadge from './DeadlineBadge.vue'

defineProps<{ items: Application[], showAgent?: boolean, showClient?: boolean }>()
defineEmits<{ open: [application: Application] }>()
</script>

<template>
  <!-- Table on wide screens, stacked rows on phones. -->
  <div class="hidden md:block">
    <el-table :data="items" row-class-name="cursor-pointer" @row-click="(row: Application) => $emit('open', row)">
      <el-table-column label="№" width="80">
        <template #default="{ row }"><span class="font-mono text-sm text-muted">{{ row.id }}</span></template>
      </el-table-column>
      <el-table-column label="Объект" min-width="220">
        <template #default="{ row }">
          <p class="font-medium text-ink">{{ row.property?.title ?? `Объект №${row.propertyId}` }}</p>
          <p class="text-xs text-muted">{{ row.property?.city }}</p>
        </template>
      </el-table-column>
      <el-table-column v-if="showClient" label="Клиент" min-width="170">
        <template #default="{ row }">
          <p class="text-ink">{{ row.clientFullName || 'Не указан' }}</p>
          <p class="text-xs text-muted tabular">{{ row.clientPhone }}</p>
        </template>
      </el-table-column>
      <el-table-column v-if="showAgent" label="Автор" min-width="170">
        <template #default="{ row }"><span class="text-ink">{{ personName(row.agent, 'Агент') }}</span></template>
      </el-table-column>
      <el-table-column label="Статус" width="180">
        <template #default="{ row }"><StatusTag :tone="APPLICATION_STATUS[row.status as Application['status']].tone" :label="APPLICATION_STATUS[row.status as Application['status']].label" /></template>
      </el-table-column>
      <el-table-column label="Срок" width="120">
        <template #default="{ row }"><DeadlineBadge v-if="row.status === 'sent'" compact :expires-at="row.expiresAt" /></template>
      </el-table-column>
      <el-table-column label="Комиссия" width="150" align="right">
        <template #default="{ row }"><span class="tabular text-ink">{{ row.commissionAmount ? formatPrice(row.commissionAmount) : '' }}</span></template>
      </el-table-column>
      <el-table-column label="Создана" width="130">
        <template #default="{ row }"><span class="text-sm text-muted">{{ formatDate(row.createdAt) }}</span></template>
      </el-table-column>
    </el-table>
  </div>
  <ul class="flex flex-col gap-3 md:hidden">
    <li v-for="row in items" :key="row.id">
      <button type="button" class="surface press w-full p-4 text-left" @click="$emit('open', row)">
        <div class="flex items-start justify-between gap-3">
          <span class="font-medium text-ink">{{ row.property?.title ?? `Объект №${row.propertyId}` }}</span>
          <StatusTag :tone="APPLICATION_STATUS[row.status].tone" :label="APPLICATION_STATUS[row.status].label" />
        </div>
        <p class="mt-1 text-sm text-muted">№{{ row.id }}, {{ formatDate(row.createdAt) }}</p>
        <p v-if="showClient" class="mt-1 text-sm text-ink">{{ row.clientFullName }}</p>
        <p v-if="showAgent" class="mt-1 text-sm text-ink">{{ personName(row.agent, 'Агент') }}</p>
        <p v-if="row.status === 'sent'" class="mt-1 text-sm">Срок: <DeadlineBadge compact :expires-at="row.expiresAt" /></p>
      </button>
    </li>
  </ul>
</template>
