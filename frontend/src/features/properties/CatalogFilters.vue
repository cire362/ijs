<script setup lang="ts">
import { computed } from 'vue'
import type { CatalogFacets, SaleStatus } from '@/api/types'
import { BUILD_STAGES, CONSTRUCTION_TYPES, CONTRACT_TYPES, FINISHING_TYPES, READINESS_TYPES, REGISTRATIONS } from '@/utils/propertyOptions'
import { SALE_STATUS } from '@/utils/status'

export interface CatalogFilterState {
  status: SaleStatus | ''
  region: string
  city: string
  developerId: number | null
  rooms: number | null
  floors: number | null
  priceMin: number | null
  priceMax: number | null
  landMin: number | null
  landMax: number | null
  houseMin: number | null
  houseMax: number | null
  buildStage: string
  readinessType: string
  constructionType: string
  finishingType: string
  contractType: string
  registration: string
}

const props = defineProps<{ facets: CatalogFacets | null, showStatus: boolean, showDeveloper: boolean }>()
const filters = defineModel<CatalogFilterState>({ required: true })
defineEmits<{ reset: [] }>()

const cities = computed(() => (props.facets?.cities ?? []).filter((city) => !filters.value.region || city.region === filters.value.region))

function setRegion (value: string) {
  filters.value.region = value ?? ''
  if (filters.value.city && !cities.value.some((city) => city.value === filters.value.city)) filters.value.city = ''
}

const selects = [
  { key: 'buildStage', label: 'Стадия строительства', options: BUILD_STAGES },
  { key: 'readinessType', label: 'Готовность', options: READINESS_TYPES },
  { key: 'constructionType', label: 'Конструкция', options: CONSTRUCTION_TYPES },
  { key: 'finishingType', label: 'Отделка', options: FINISHING_TYPES },
  { key: 'contractType', label: 'Тип договора', options: CONTRACT_TYPES },
  { key: 'registration', label: 'Категория земли', options: REGISTRATIONS }
] as const

const ranges = [
  { min: 'priceMin', max: 'priceMax', label: 'Цена, ₽', step: 500000 },
  { min: 'houseMin', max: 'houseMax', label: 'Площадь дома, м²', step: 10 },
  { min: 'landMin', max: 'landMax', label: 'Участок, соток', step: 1 }
] as const

function rangeError (min: number | null, max: number | null) {
  return min != null && max != null && min > max
}
</script>

<template>
  <div class="flex flex-col gap-5">
    <fieldset v-if="showStatus" class="flex flex-col gap-1.5">
      <legend class="mb-1.5 text-sm font-medium text-ink">Статус</legend>
      <div class="grid grid-cols-2 gap-1 rounded-control bg-surface-2 p-1">
        <button v-for="option in [{ value: '', label: 'Любой' }, ...Object.entries(SALE_STATUS).map(([value, meta]) => ({ value, label: meta.label }))]" :key="option.value" type="button" class="rounded-[8px] px-2 py-1.5 text-sm" :class="filters.status === option.value ? 'bg-surface font-medium text-ink shadow-soft' : 'text-muted hover:text-ink'" :aria-pressed="filters.status === option.value" @click="filters.status = option.value as SaleStatus | ''">{{ option.label }}</button>
      </div>
    </fieldset>

    <label class="flex flex-col gap-1.5 text-sm font-medium text-ink">Регион
      <el-select :model-value="filters.region" placeholder="Все регионы" clearable filterable @update:model-value="setRegion">
        <el-option v-for="region in facets?.regions ?? []" :key="region.value" :value="region.value" :label="region.value">
          <span class="flex justify-between gap-3"><span class="truncate">{{ region.value }}</span><span class="text-subtle tabular">{{ region.count }}</span></span>
        </el-option>
      </el-select>
    </label>
    <label class="flex flex-col gap-1.5 text-sm font-medium text-ink">Населённый пункт
      <el-select v-model="filters.city" placeholder="Все" clearable filterable>
        <el-option v-for="city in cities" :key="`${city.region}:${city.value}`" :value="city.value" :label="city.value">
          <span class="flex justify-between gap-3"><span class="truncate">{{ city.value }}</span><span class="text-subtle tabular">{{ city.count }}</span></span>
        </el-option>
      </el-select>
    </label>
    <label v-if="showDeveloper" class="flex flex-col gap-1.5 text-sm font-medium text-ink">Застройщик
      <el-select v-model="filters.developerId" placeholder="Все застройщики" clearable filterable>
        <el-option v-for="dev in facets?.developers ?? []" :key="dev.id" :value="dev.id" :label="dev.name">
          <span class="flex justify-between gap-3"><span class="truncate">{{ dev.name }}</span><span class="text-subtle tabular">{{ dev.count }}</span></span>
        </el-option>
      </el-select>
    </label>

    <div v-for="range in ranges" :key="range.min" class="flex flex-col gap-1.5">
      <span class="text-sm font-medium text-ink">{{ range.label }}</span>
      <div class="grid grid-cols-2 gap-2">
        <el-input-number v-model="filters[range.min]" :min="0" :step="range.step" :controls="false" placeholder="от" class="!w-full" :aria-label="`${range.label} от`" />
        <el-input-number v-model="filters[range.max]" :min="0" :step="range.step" :controls="false" placeholder="до" class="!w-full" :aria-label="`${range.label} до`" />
      </div>
      <p v-if="rangeError(filters[range.min], filters[range.max])" class="text-xs text-danger">«От» больше, чем «до»</p>
    </div>

    <div class="grid grid-cols-2 gap-2">
      <label class="flex flex-col gap-1.5 text-sm font-medium text-ink">Комнат
        <el-input-number v-model="filters.rooms" :min="1" :max="50" :controls="false" placeholder="Любое" class="!w-full" />
      </label>
      <label class="flex flex-col gap-1.5 text-sm font-medium text-ink">Этажей
        <el-input-number v-model="filters.floors" :min="1" :max="10" :controls="false" placeholder="Любое" class="!w-full" />
      </label>
    </div>

    <label v-for="select in selects" :key="select.key" class="flex flex-col gap-1.5 text-sm font-medium text-ink">{{ select.label }}
      <el-select v-model="filters[select.key]" placeholder="Не важно" clearable>
        <el-option v-for="option in select.options" :key="option" :value="option" :label="option" />
      </el-select>
    </label>

    <el-button text type="primary" class="self-start" @click="$emit('reset')">Сбросить все фильтры</el-button>
  </div>
</template>
