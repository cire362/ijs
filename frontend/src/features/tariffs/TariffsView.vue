<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { IconEdit, IconPercentage, IconSearch } from '@tabler/icons-vue'
import { tariffsApi } from '@/api/endpoints'
import { errorMessage } from '@/api/http'
import type { TariffComplex, TariffCounterparty, TariffView } from '@/api/types'
import { useAsync } from '@/composables/useAsync'
import { useAuthStore } from '@/stores/auth'
import { formatPercent } from '@/utils/format'
import PageHeader from '@/components/PageHeader.vue'
import EmptyState from '@/components/EmptyState.vue'
import ErrorState from '@/components/ErrorState.vue'
import SkeletonRows from '@/components/SkeletonRows.vue'
import StatusTag from '@/components/StatusTag.vue'

const auth = useAuthStore()
const search = ref('')
const includeInactive = ref(true)
const { data, loading, error, run } = useAsync(
  () => auth.isAdmin ? tariffsApi.adminView('apartments', includeInactive.value) : tariffsApi.view('apartments'),
  { type: 'developer', category: 'apartments', counterparties: [] } as TariffView
)
watch(includeInactive, () => run())
void run()

const groups = computed(() => {
  const q = search.value.trim().toLowerCase()
  return data.value.counterparties
    .map((dev) => ({ ...dev, complexes: dev.complexes.filter((c) => !q || dev.name.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)) }))
    .filter((dev) => dev.complexes.length && (auth.isAdmin || dev.complexes.some((c) => c.rate)))
})

function rateText (complex: TariffComplex) {
  const rate = complex.rate
  if (!rate) return ''
  return rate.commissionTo && rate.commissionTo !== rate.commissionFrom
    ? `от ${formatPercent(rate.commissionFrom)} до ${formatPercent(rate.commissionTo)}`
    : formatPercent(rate.commissionFrom)
}

const dialog = ref(false)
const saving = ref(false)
const editing = ref<{ developer: TariffCounterparty, complex: TariffComplex } | null>(null)
const form = reactive({ commissionFrom: 3 as number | null, commissionTo: null as number | null, notes: '', isActive: true })

function edit (developer: TariffCounterparty, complex: TariffComplex) {
  editing.value = { developer, complex }
  const rate = complex.rate
  Object.assign(form, {
    commissionFrom: rate ? Number(rate.commissionFrom) : 3,
    commissionTo: rate?.commissionTo ? Number(rate.commissionTo) : null,
    notes: rate?.notes ?? '',
    isActive: rate?.isActive ?? true
  })
  dialog.value = true
}

async function save () {
  if (!editing.value || form.commissionFrom == null) return
  if (form.commissionTo != null && form.commissionTo < form.commissionFrom) { ElMessage.error('Верхняя граница меньше нижней'); return }
  saving.value = true
  try {
    await tariffsApi.putRate(editing.value.complex.id, 'apartments', {
      commissionFrom: form.commissionFrom,
      commissionTo: form.commissionTo,
      notes: form.notes.trim() || null,
      isActive: form.isActive
    })
    ElMessage.success('Тариф сохранён. Новые заявки рассчитаются по нему')
    dialog.value = false
    await run()
  } catch (e) {
    ElMessage.error(errorMessage(e))
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div>
    <PageHeader title="Тарифы" description="Вознаграждение агента по объектам застройщиков. Комиссия в заявке считается от нижней границы действующего тарифа.">
      <template #actions>
        <el-checkbox v-if="auth.isAdmin" v-model="includeInactive">Показывать неактивные</el-checkbox>
        <el-input v-model="search" placeholder="Застройщик или объект" clearable class="w-64" aria-label="Поиск">
          <template #prefix><IconSearch :size="16" /></template>
        </el-input>
      </template>
    </PageHeader>

    <ErrorState v-if="error" :message="error" @retry="run" />
    <SkeletonRows v-else-if="loading && !data.counterparties.length" :rows="4" height="120px" />
    <EmptyState v-else-if="!groups.length" :icon="IconPercentage" :title="search ? 'Ничего не найдено' : 'Тарифы пока не заданы'" :text="auth.isAdmin ? 'Задайте тариф у объекта застройщика.' : 'Когда администратор задаст тарифы, они появятся здесь.'" />
    <div v-else class="flex flex-col gap-5">
      <section v-for="dev in groups" :key="dev.id" class="surface overflow-hidden">
        <h2 class="border-b border-line bg-surface-2 px-5 py-3 font-semibold text-ink">{{ dev.name }}</h2>
        <ul>
          <li v-for="complex in dev.complexes" :key="complex.id" class="flex flex-wrap items-center gap-x-6 gap-y-1 border-t border-line px-5 py-3 first:border-t-0">
            <router-link :to="`/properties/${complex.id}`" class="min-w-0 flex-1 truncate text-ink hover:text-accent">{{ complex.name }}</router-link>
            <span v-if="complex.rate" class="w-32 text-right font-semibold text-ink tabular">{{ rateText(complex) }}</span>
            <span v-else class="w-32 text-right text-sm text-subtle">Не задан</span>
            <span class="hidden min-w-0 basis-full truncate text-sm text-muted md:block md:basis-64">{{ complex.rate?.notes }}</span>
            <StatusTag v-if="complex.rate && !complex.rate.isActive" tone="neutral" label="Неактивен" />
            <el-button v-if="auth.isAdmin" text size="small" :aria-label="`Изменить тариф ${complex.name}`" @click="edit(dev, complex)"><IconEdit :size="17" /></el-button>
          </li>
        </ul>
      </section>
    </div>

    <el-dialog v-model="dialog" title="Тариф объекта" width="min(480px, 94vw)" align-center>
      <p class="mb-4 text-sm text-muted">{{ editing?.developer.name }}, {{ editing?.complex.name }}</p>
      <el-form label-position="top" @submit.prevent="save">
        <div class="grid grid-cols-2 gap-x-4">
          <el-form-item label="Комиссия от, %" required><el-input-number v-model="form.commissionFrom" :min="0" :max="100" :precision="3" :step="0.5" class="!w-full" /></el-form-item>
          <el-form-item label="Комиссия до, %"><el-input-number v-model="form.commissionTo" :min="0" :max="100" :precision="3" :step="0.5" class="!w-full" /></el-form-item>
        </div>
        <el-form-item label="Примечания"><el-input v-model="form.notes" type="textarea" :autosize="{ minRows: 2, maxRows: 6 }" maxlength="5000" /></el-form-item>
        <el-form-item><el-switch v-model="form.isActive" active-text="Действует" inactive-text="Отключён" /></el-form-item>
        <p class="text-xs text-subtle">Изменение не пересчитывает уже поданные заявки и записывается в журнал изменений.</p>
      </el-form>
      <template #footer>
        <el-button @click="dialog = false">Отмена</el-button>
        <el-button type="primary" :loading="saving" @click="save">Сохранить</el-button>
      </template>
    </el-dialog>
  </div>
</template>
