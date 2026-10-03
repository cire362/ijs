<script setup lang="ts">
import { computed, onMounted, reactive, ref, shallowRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { IconAdjustmentsHorizontal, IconHomeSearch, IconPlus, IconSearch, IconX } from '@tabler/icons-vue'
import { propertiesApi } from '@/api/endpoints'
import type { CatalogFacets, Page, Property } from '@/api/types'
import { useAsync } from '@/composables/useAsync'
import { useAuthStore } from '@/stores/auth'
import { formatPrice, pluralize } from '@/utils/format'
import { SALE_STATUS } from '@/utils/status'
import PageHeader from '@/components/PageHeader.vue'
import EmptyState from '@/components/EmptyState.vue'
import ErrorState from '@/components/ErrorState.vue'
import PropertyCard from '@/components/property/PropertyCard.vue'
import PropertyFormDialog from './PropertyFormDialog.vue'
import CatalogFilters, { type CatalogFilterState } from './CatalogFilters.vue'

const PAGE_SIZE = 24
const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const canCreate = computed(() => auth.isAdmin || (auth.isDeveloper && !auth.isPendingDeveloper))
const title = computed(() => auth.isDeveloper ? 'Мои объекты' : auth.isAdmin ? 'Объекты' : 'Каталог')
const createOpen = ref(false)
const drawer = ref(false)
const facets = shallowRef<CatalogFacets | null>(null)

const NUMBER_KEYS = ['developerId', 'rooms', 'floors', 'priceMin', 'priceMax', 'landMin', 'landMax', 'houseMin', 'houseMax'] as const
const TEXT_KEYS = ['status', 'region', 'city', 'buildStage', 'readinessType', 'constructionType', 'finishingType', 'contractType', 'registration'] as const

function emptyFilters (): CatalogFilterState {
  return { status: '', region: '', city: '', developerId: null, rooms: null, floors: null, priceMin: null, priceMax: null, landMin: null, landMax: null, houseMin: null, houseMax: null, buildStage: '', readinessType: '', constructionType: '', finishingType: '', contractType: '', registration: '' }
}

function fromQuery (): CatalogFilterState {
  const state = emptyFilters()
  for (const key of NUMBER_KEYS) {
    const value = Number(route.query[key])
    if (route.query[key] != null && route.query[key] !== '' && Number.isFinite(value)) state[key] = value
  }
  for (const key of TEXT_KEYS) {
    if (typeof route.query[key] === 'string') (state[key] as string) = route.query[key] as string
  }
  return state
}

const search = ref(String(route.query.q ?? ''))
const filters = reactive<CatalogFilterState>(fromQuery())
const page = ref(Math.max(1, Number(route.query.page) || 1))

const invalidRange = computed(() => [['priceMin', 'priceMax'], ['landMin', 'landMax'], ['houseMin', 'houseMax']]
  .some(([min, max]) => filters[min as keyof CatalogFilterState] != null && filters[max as keyof CatalogFilterState] != null && (filters[min as 'priceMin'] as number) > (filters[max as 'priceMax'] as number)))

const { data, loading, error, run } = useAsync(
  () => propertiesApi.list({ ...filters, status: auth.user ? filters.status : '', developerId: showDeveloper.value ? filters.developerId : null, q: search.value.trim(), page: page.value, limit: PAGE_SIZE }),
  { items: [], total: 0, page: 1, limit: PAGE_SIZE } as Page<Property>
)
const showDeveloper = computed(() => Boolean(auth.user) && !auth.isDeveloper)

function sync () {
  const query: Record<string, string> = {}
  if (search.value.trim()) query.q = search.value.trim()
  for (const [key, value] of Object.entries(filters)) if (value !== '' && value != null) query[key] = String(value)
  if (page.value > 1) query.page = String(page.value)
  void router.replace({ query })
  if (!invalidRange.value) void run()
}

let timer: ReturnType<typeof setTimeout> | undefined
watch([filters, search], () => {
  clearTimeout(timer)
  timer = setTimeout(() => { page.value = 1; sync() }, 350)
}, { deep: true })
watch(page, sync)
onMounted(() => {
  void run()
  void propertiesApi.facets().then((value) => { facets.value = value }).catch(() => {})
})

// Active filters as removable chips above the results.
const LABELS: Record<string, string> = {
  region: 'Регион', city: 'Населённый пункт', buildStage: 'Стадия', readinessType: 'Готовность', constructionType: 'Конструкция',
  finishingType: 'Отделка', contractType: 'Договор', registration: 'Земля', rooms: 'Комнат', floors: 'Этажей'
}
const chips = computed(() => {
  const list: { key: string, label: string, clear: () => void }[] = []
  const add = (key: string, label: string, keys: (keyof CatalogFilterState)[]) => list.push({ key, label, clear: () => { for (const k of keys) (filters[k] as unknown) = typeof emptyFilters()[k] === 'string' ? '' : null } })
  if (filters.status) add('status', SALE_STATUS[filters.status].label, ['status'])
  if (filters.developerId) add('developerId', facets.value?.developers.find((dev) => dev.id === filters.developerId)?.name ?? 'Застройщик', ['developerId'])
  for (const key of ['region', 'city', 'buildStage', 'readinessType', 'constructionType', 'finishingType', 'contractType', 'registration', 'rooms', 'floors'] as const) {
    if (filters[key] !== '' && filters[key] != null) add(key, `${LABELS[key]}: ${filters[key]}`, [key])
  }
  const range = (min: 'priceMin' | 'landMin' | 'houseMin', max: 'priceMax' | 'landMax' | 'houseMax', label: string, format: (v: number) => string) => {
    if (filters[min] == null && filters[max] == null) return
    const text = [filters[min] != null ? `от ${format(filters[min]!)}` : '', filters[max] != null ? `до ${format(filters[max]!)}` : ''].filter(Boolean).join(' ')
    add(min, `${label} ${text}`, [min, max])
  }
  range('priceMin', 'priceMax', 'Цена', (v) => formatPrice(v))
  range('houseMin', 'houseMax', 'Дом', (v) => `${v} м²`)
  range('landMin', 'landMax', 'Участок', (v) => `${v} сот.`)
  return list
})

function reset () {
  Object.assign(filters, emptyFilters())
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

    <div class="grid items-start gap-6 lg:grid-cols-[280px_1fr]">
      <!-- Filters: a sticky column on desktop, a drawer on smaller screens. -->
      <aside class="surface hidden max-h-[calc(100dvh-120px)] overflow-y-auto p-5 lg:sticky lg:top-24 lg:block" aria-label="Фильтры">
        <CatalogFilters v-model="filters" :facets="facets" :show-status="Boolean(auth.user)" :show-developer="showDeveloper" @reset="reset" />
      </aside>
      <el-drawer v-model="drawer" title="Фильтры" direction="ltr" size="min(360px, 92vw)" class="lg:hidden">
        <CatalogFilters v-model="filters" :facets="facets" :show-status="Boolean(auth.user)" :show-developer="showDeveloper" @reset="reset" />
        <template #footer>
          <el-button type="primary" class="w-full" @click="drawer = false">Показать {{ data.total }} {{ pluralize(data.total, 'объект', 'объекта', 'объектов') }}</el-button>
        </template>
      </el-drawer>

      <section class="min-w-0">
        <div class="mb-4 flex gap-2">
          <el-input v-model="search" placeholder="Название, населённый пункт, улица или описание" clearable aria-label="Поиск" size="large">
            <template #prefix><IconSearch :size="18" /></template>
          </el-input>
          <el-button size="large" class="lg:!hidden" @click="drawer = true">
            <IconAdjustmentsHorizontal :size="18" /><span class="ml-1.5 hidden sm:inline">Фильтры</span>
            <span v-if="chips.length" class="ml-1.5 rounded-full bg-accent px-1.5 text-xs leading-5 text-accent-contrast tabular">{{ chips.length }}</span>
          </el-button>
        </div>

        <div v-if="chips.length" class="mb-4 flex flex-wrap items-center gap-2">
          <button v-for="chip in chips" :key="chip.key" type="button" class="press inline-flex items-center gap-1 rounded-full bg-accent-soft px-3 py-1 text-sm text-accent hover:bg-[color-mix(in_srgb,var(--accent)_18%,transparent)]" :aria-label="`Убрать фильтр ${chip.label}`" @click="chip.clear()">
            {{ chip.label }}<IconX :size="14" />
          </button>
          <button type="button" class="link text-sm" @click="reset">Сбросить все</button>
        </div>

        <p v-if="invalidRange" class="mb-4 rounded-control bg-warning-soft px-3 py-2 text-sm text-ink">Проверьте диапазон: значение «от» больше, чем «до».</p>
        <ErrorState v-else-if="error" :message="error" @retry="run" />
        <div v-else-if="loading && !data.items.length" class="grid gap-5 sm:grid-cols-2 2xl:grid-cols-3">
          <div v-for="i in 6" :key="i" class="skeleton aspect-[4/4.4] rounded-surface" />
        </div>
        <EmptyState v-else-if="!data.items.length" :icon="IconHomeSearch" :title="chips.length || search ? 'Ничего не нашлось' : 'Объектов пока нет'" :text="chips.length || search ? 'Измените условия поиска или сбросьте фильтры.' : canCreate ? 'Добавьте первый объект, чтобы получать заявки.' : 'Загляните позже: застройщики регулярно добавляют дома.'">
          <el-button v-if="chips.length || search" @click="reset(); search = ''">Сбросить фильтры</el-button>
          <el-button v-else-if="canCreate" type="primary" @click="createOpen = true">Добавить объект</el-button>
        </EmptyState>
        <template v-else>
          <p class="mb-3 text-sm text-muted">{{ data.total }} {{ pluralize(data.total, 'объект', 'объекта', 'объектов') }}</p>
          <div class="grid gap-5 transition-opacity sm:grid-cols-2 2xl:grid-cols-3" :class="{ 'opacity-60': loading }">
            <PropertyCard v-for="item in data.items" :key="item.id" :property="item" />
          </div>
          <el-pagination v-if="data.total > PAGE_SIZE" v-model:current-page="page" class="mt-8 justify-center" layout="prev, pager, next" :page-size="PAGE_SIZE" :total="data.total" background />
        </template>
      </section>
    </div>

    <PropertyFormDialog v-model="createOpen" @saved="created" />
  </div>
</template>
