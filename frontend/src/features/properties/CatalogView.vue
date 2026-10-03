<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { IconAdjustmentsHorizontal, IconHomeSearch, IconPlus, IconSearch } from '@tabler/icons-vue'
import { propertiesApi } from '@/api/endpoints'
import type { Page, Property, SaleStatus } from '@/api/types'
import { useAsync } from '@/composables/useAsync'
import { useAuthStore } from '@/stores/auth'
import { pluralize } from '@/utils/format'
import { SALE_STATUS } from '@/utils/status'
import PageHeader from '@/components/PageHeader.vue'
import EmptyState from '@/components/EmptyState.vue'
import ErrorState from '@/components/ErrorState.vue'
import PropertyCard from '@/components/property/PropertyCard.vue'
import AddressInput from '@/components/property/AddressInput.vue'
import PropertyFormDialog from './PropertyFormDialog.vue'

const PAGE_SIZE = 24
const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const canCreate = computed(() => auth.isAdmin || (auth.isDeveloper && !auth.isPendingDeveloper))
const title = computed(() => auth.isDeveloper ? 'Мои объекты' : auth.isAdmin ? 'Объекты' : 'Каталог')
const createOpen = ref(false)
const moreFilters = ref(false)

function readNumber (value: unknown) {
  const number = Number(value)
  return Number.isFinite(number) && value !== '' && value != null ? number : null
}

const filters = reactive({
  q: String(route.query.q ?? ''),
  region: String(route.query.region ?? ''),
  city: String(route.query.city ?? ''),
  status: (String(route.query.status ?? '') as SaleStatus | ''),
  rooms: readNumber(route.query.rooms),
  priceMin: readNumber(route.query.priceMin),
  priceMax: readNumber(route.query.priceMax)
})
const page = ref(Math.max(1, readNumber(route.query.page) ?? 1))

const { data, loading, error, run } = useAsync(
  () => propertiesApi.list({ ...filters, page: page.value, limit: PAGE_SIZE }),
  { items: [], total: 0, page: 1, limit: PAGE_SIZE } as Page<Property>
)

function sync () {
  const query = Object.fromEntries(Object.entries({ ...filters, page: page.value > 1 ? page.value : null })
    .filter(([, value]) => value !== '' && value != null)
    .map(([key, value]) => [key, String(value)]))
  void router.replace({ query })
  if (!priceError.value) void run()
}

let timer: ReturnType<typeof setTimeout> | undefined
watch(filters, () => {
  clearTimeout(timer)
  timer = setTimeout(() => { page.value = 1; sync() }, 350)
}, { deep: true })
watch(page, sync)
void run()

const activeFilters = computed(() => [filters.region, filters.city, filters.status, filters.rooms, filters.priceMin, filters.priceMax].filter((v) => v !== '' && v != null).length)
const priceError = computed(() => filters.priceMin != null && filters.priceMax != null && filters.priceMin > filters.priceMax)

function reset () {
  Object.assign(filters, { q: '', region: '', city: '', status: '', rooms: null, priceMin: null, priceMax: null })
}

function created (property: Property) {
  void router.push(`/properties/${property.id}`)
}
</script>

<template>
  <div>
    <PageHeader :title="title" :description="auth.isApplicant ? 'Объекты подтверждённых застройщиков. Откройте карточку, чтобы подать заявку.' : undefined">
      <template #actions>
        <el-button v-if="canCreate" type="primary" @click="createOpen = true"><IconPlus :size="18" class="mr-1.5" />Добавить объект</el-button>
      </template>
    </PageHeader>

    <section class="surface mb-6 p-4" aria-label="Фильтры">
      <div class="flex flex-col gap-3 md:flex-row">
        <el-input v-model="filters.q" placeholder="Название, улица или описание" clearable class="flex-1" aria-label="Поиск">
          <template #prefix><IconSearch :size="17" /></template>
        </el-input>
        <el-select v-if="auth.user" v-model="filters.status" placeholder="Любой статус" clearable class="md:w-48" aria-label="Статус">
          <el-option v-for="(meta, value) in SALE_STATUS" :key="value" :value="value" :label="meta.label" />
        </el-select>
        <el-button @click="moreFilters = !moreFilters">
          <IconAdjustmentsHorizontal :size="18" class="mr-1.5" />Фильтры<span v-if="activeFilters" class="ml-1.5 rounded-full bg-accent px-1.5 text-xs leading-5 text-accent-contrast tabular">{{ activeFilters }}</span>
        </el-button>
      </div>
      <div v-if="moreFilters" class="mt-4 grid gap-3 border-t border-line pt-4 sm:grid-cols-2 lg:grid-cols-5">
        <label class="flex flex-col gap-1.5 text-sm text-muted">Регион<AddressInput v-model="filters.region" kind="region" /></label>
        <label class="flex flex-col gap-1.5 text-sm text-muted">Город<AddressInput v-model="filters.city" kind="city" :region="filters.region" /></label>
        <label class="flex flex-col gap-1.5 text-sm text-muted">Комнат<el-input-number v-model="filters.rooms" :min="1" :max="20" :controls="false" class="!w-full" /></label>
        <label class="flex flex-col gap-1.5 text-sm text-muted">Цена от, ₽<el-input-number v-model="filters.priceMin" :min="0" :step="500000" :controls="false" class="!w-full" /></label>
        <label class="flex flex-col gap-1.5 text-sm text-muted">Цена до, ₽<el-input-number v-model="filters.priceMax" :min="0" :step="500000" :controls="false" class="!w-full" /></label>
        <p v-if="priceError" class="text-sm text-danger sm:col-span-2 lg:col-span-5">Минимальная цена больше максимальной</p>
        <div class="sm:col-span-2 lg:col-span-5"><el-button text type="primary" @click="reset">Сбросить фильтры</el-button></div>
      </div>
    </section>

    <ErrorState v-if="error" :message="error" @retry="run" />
    <div v-else-if="loading && !data.items.length" class="grid gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      <div v-for="i in 8" :key="i" class="skeleton aspect-[4/4.4] rounded-surface" />
    </div>
    <EmptyState v-else-if="!data.items.length" :icon="IconHomeSearch" :title="activeFilters || filters.q ? 'Ничего не нашлось' : 'Объектов пока нет'" :text="activeFilters || filters.q ? 'Измените условия поиска или сбросьте фильтры.' : canCreate ? 'Добавьте первый объект, чтобы получать заявки.' : 'Загляните позже: застройщики регулярно добавляют дома.'">
      <el-button v-if="activeFilters || filters.q" @click="reset">Сбросить фильтры</el-button>
      <el-button v-else-if="canCreate" type="primary" @click="createOpen = true">Добавить объект</el-button>
    </EmptyState>
    <template v-else>
      <p class="mb-3 text-sm text-muted">{{ data.total }} {{ pluralize(data.total, 'объект', 'объекта', 'объектов') }}</p>
      <div class="grid gap-5 transition-opacity sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4" :class="{ 'opacity-60': loading }">
        <PropertyCard v-for="item in data.items" :key="item.id" :property="item" />
      </div>
      <el-pagination v-if="data.total > PAGE_SIZE" v-model:current-page="page" class="mt-8 justify-center" layout="prev, pager, next" :page-size="PAGE_SIZE" :total="data.total" background />
    </template>

    <PropertyFormDialog v-model="createOpen" @saved="created" />
  </div>
</template>
