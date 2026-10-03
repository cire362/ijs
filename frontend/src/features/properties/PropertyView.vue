<script setup lang="ts">
import { computed, defineAsyncComponent, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import type { UploadRequestOptions } from 'element-plus'
import { IconArrowLeft, IconDownload, IconExternalLink, IconEdit, IconFileText, IconHistory, IconMapPin, IconPhoto, IconPhotoPlus, IconTrash, IconUpload } from '@tabler/icons-vue'
import { propertiesApi } from '@/api/endpoints'
import { errorMessage } from '@/api/http'
import type { Property } from '@/api/types'
import { useAsync } from '@/composables/useAsync'
import { confirmAction } from '@/composables/confirm'
import { useAuthStore } from '@/stores/auth'
import { formatArea, formatDate, formatPrice } from '@/utils/format'
import { propertyImageUrl } from '@/utils/propertyImages'
import { SALE_STATUS } from '@/utils/status'
import StatusTag from '@/components/StatusTag.vue'
import ErrorState from '@/components/ErrorState.vue'
import SkeletonRows from '@/components/SkeletonRows.vue'
import PropertyFormDialog from './PropertyFormDialog.vue'
import ApplyDialog from './ApplyDialog.vue'

const PropertyMap = defineAsyncComponent(() => import('@/components/map/PropertyMap.vue'))

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const id = computed(() => Number(route.params.id))
const active = ref(0)
const { data: property, loading, error, run } = useAsync(() => propertiesApi.get(id.value), null as Property | null)
watch(id, () => { active.value = 0; void run() }, { immediate: true })

const editOpen = ref(false)
const applyOpen = ref(false)
const busy = ref(false)

const canManage = computed(() => Boolean(property.value) && (auth.isAdmin || (auth.isDeveloper && !auth.isPendingDeveloper && property.value?.developerId === auth.user?.id)))
const canApply = computed(() => auth.isApplicant && property.value?.saleStatus === 'available')
const images = computed(() => property.value?.images ?? [])
const current = computed(() => images.value[active.value] ?? images.value[0] ?? null)
const address = computed(() => property.value ? [property.value.region, property.value.city, property.value.street].filter(Boolean).join(', ') : '')
const hasPoint = computed(() => property.value?.latitude != null && property.value?.longitude != null)
const yandexLink = computed(() => hasPoint.value
  ? `https://yandex.ru/maps/?pt=${property.value!.longitude},${property.value!.latitude}&z=16&l=map`
  : `https://yandex.ru/maps/?text=${encodeURIComponent(address.value)}`)

const developerName = computed(() => {
  const dev = property.value?.developer
  return dev?.companyName || [dev?.lastName, dev?.firstName].filter(Boolean).join(' ') || ''
})

const specs = computed(() => {
  const p = property.value
  if (!p) return []
  return [
    ['Площадь дома', formatArea(p.houseArea)],
    ['Участок', formatArea(p.landArea, 'сот.')],
    ['Этажность', p.floors ? String(p.floors) : ''],
    ['Комнат', p.rooms != null ? String(p.rooms) : ''],
    ['Стадия строительства', p.buildStage],
    ['Готовность', p.readinessType],
    ['Конструкция', p.constructionType],
    ['Отделка', p.finishingType],
    ['Тип договора', p.contractType],
    ['Категория земли', p.registration],
    ['№ участка', p.plotNumber]
  ].filter(([, value]) => value) as [string, string][]
})

async function withBusy (task: () => Promise<unknown>, success: string) {
  busy.value = true
  try {
    await task()
    ElMessage.success(success)
    await run()
  } catch (e) {
    ElMessage.error(errorMessage(e))
  } finally {
    busy.value = false
  }
}

async function uploadImages (options: UploadRequestOptions) {
  await withBusy(() => propertiesApi.addImages(id.value, [options.file]), 'Фото добавлено')
}
async function uploadDocument (options: UploadRequestOptions) {
  await withBusy(() => propertiesApi.addDocument(id.value, options.file), 'Документ добавлен')
}
async function removeImage (imageId: number) {
  if (!(await confirmAction('Удалить фото?', 'Файл будет удалён без возможности восстановления.', 'Удалить', true))) return
  active.value = 0
  await withBusy(() => propertiesApi.removeImage(imageId), 'Фото удалено')
}
async function removeDocument (documentId: number) {
  if (!(await confirmAction('Удалить документ?', 'Ссылка на документ перестанет работать сразу.', 'Удалить', true))) return
  await withBusy(() => propertiesApi.removeDocument(documentId), 'Документ удалён')
}
async function removeProperty () {
  if (!(await confirmAction('Удалить объект?', 'Объект без заявок удаляется вместе с фото и документами. Объект с историей заявок удалить нельзя.', 'Удалить объект', true))) return
  busy.value = true
  try {
    await propertiesApi.remove(id.value)
    ElMessage.success('Объект удалён')
    await router.push('/properties')
  } catch (e) {
    ElMessage.error(errorMessage(e))
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div>
    <router-link to="/properties" class="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"><IconArrowLeft :size="16" />К объектам</router-link>

    <ErrorState v-if="error" :message="error" @retry="run" />
    <div v-else-if="loading && !property" class="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <div class="skeleton aspect-[4/3] rounded-surface" />
      <SkeletonRows :rows="5" />
    </div>

    <div v-else-if="property" class="grid items-start gap-6 lg:grid-cols-[1.45fr_1fr] xl:gap-8">
      <div class="min-w-0">
        <!-- Gallery -->
        <section class="surface overflow-hidden">
          <div class="relative aspect-[16/10] bg-surface-2">
            <img v-if="current" :src="propertyImageUrl(current.url)" :alt="current.caption || property.title" class="size-full object-cover">
            <div v-else class="grid size-full place-items-center text-subtle"><IconPhoto :size="40" /></div>
          </div>
          <div v-if="images.length > 1 || canManage" class="flex gap-2 overflow-x-auto p-3">
            <div v-for="(image, index) in images" :key="image.id" class="group relative shrink-0">
              <button type="button" class="block size-20 overflow-hidden rounded-control ring-2 transition" :class="index === active ? 'ring-accent' : 'ring-transparent hover:ring-line-strong'" :aria-label="`Фото ${index + 1}`" @click="active = index">
                <img :src="propertyImageUrl(image.url)" alt="" class="size-full object-cover" loading="lazy">
              </button>
              <button v-if="canManage" type="button" class="absolute -right-1.5 -top-1.5 hidden size-6 place-items-center rounded-full bg-surface text-danger shadow-soft ring-1 ring-line group-hover:grid focus:grid" aria-label="Удалить фото" @click="removeImage(image.id)"><IconTrash :size="14" /></button>
            </div>
            <el-upload v-if="canManage" :show-file-list="false" :http-request="uploadImages" accept="image/jpeg,image/png,image/webp" multiple :disabled="busy">
              <button type="button" class="grid size-20 place-items-center rounded-control border border-dashed border-line-strong text-muted hover:border-accent hover:text-accent" aria-label="Добавить фото"><IconPhotoPlus :size="22" /></button>
            </el-upload>
          </div>
        </section>

        <section v-if="property.description" class="mt-6">
          <h2 class="mb-2 text-lg font-semibold text-ink">Описание</h2>
          <p class="max-w-[70ch] whitespace-pre-line text-[15px] leading-relaxed text-ink">{{ property.description }}</p>
        </section>

        <section class="mt-6">
          <div class="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h2 class="text-lg font-semibold text-ink">Расположение</h2>
            <a :href="yandexLink" target="_blank" rel="noopener" class="link inline-flex items-center gap-1 text-sm">Открыть в Яндекс Картах <IconExternalLink :size="15" /></a>
          </div>
          <p class="mb-3 text-[15px] text-ink">{{ address }}</p>
          <PropertyMap v-if="hasPoint" class="h-80 w-full" :lat="property.latitude" :lng="property.longitude" :precision="property.geoPrecision" />
          <div v-else class="rounded-surface bg-surface-2 px-5 py-6 text-sm text-muted">
            Точка на карте ещё не указана.<template v-if="canManage"> Отметьте участок в <button type="button" class="link" @click="editOpen = true">редактировании объекта</button>.</template>
          </div>
          <p v-if="hasPoint && (property.geoPrecision ?? 0) > 1" class="mt-2 text-xs text-subtle">Точка определена по адресу приблизительно{{ property.geoPrecision === 3 ? ', по населённому пункту' : ', по улице' }}.</p>
        </section>

        <section v-if="specs.length" class="mt-6">
          <h2 class="mb-3 text-lg font-semibold text-ink">Характеристики</h2>
          <dl class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <div v-for="[label, value] in specs" :key="label" class="rounded-control bg-surface-2 px-4 py-3">
              <dt class="text-xs text-muted">{{ label }}</dt>
              <dd class="mt-0.5 font-medium text-ink">{{ value }}</dd>
            </div>
          </dl>
        </section>
      </div>

      <aside class="flex flex-col gap-4 lg:sticky lg:top-24">
        <section class="surface p-5">
          <div class="flex items-start justify-between gap-3">
            <h1 class="text-2xl font-semibold text-ink">{{ property.title }}</h1>
            <StatusTag :tone="SALE_STATUS[property.saleStatus].tone" :label="SALE_STATUS[property.saleStatus].label" />
          </div>
          <p class="mt-2 flex items-start gap-1.5 text-muted"><IconMapPin :size="18" class="mt-0.5" />{{ address }}</p>
          <p class="mt-4 text-3xl font-semibold text-ink tabular">{{ formatPrice(property.price) }}</p>
          <p v-if="developerName" class="mt-1 text-sm text-muted">Застройщик: <span class="text-ink">{{ developerName }}</span></p>
          <div v-if="canApply" class="mt-5">
            <el-button type="primary" size="large" class="w-full" @click="applyOpen = true">Подать заявку</el-button>
          </div>
          <p v-else-if="auth.isApplicant" class="mt-5 rounded-control bg-surface-2 px-3 py-2 text-sm text-muted">Объект {{ SALE_STATUS[property.saleStatus].label.toLowerCase() }}, новые заявки не принимаются.</p>
          <div v-if="canManage" class="mt-5 grid grid-cols-2 gap-2">
            <el-button :disabled="busy" @click="editOpen = true"><IconEdit :size="17" class="mr-1.5" />Изменить</el-button>
            <el-button type="danger" plain :disabled="busy" @click="removeProperty"><IconTrash :size="17" class="mr-1.5" />Удалить</el-button>
            <router-link v-if="auth.isAdmin" :to="{ path: '/admin/audit', query: { entityType: 'property', entityId: String(property.id) } }" class="col-span-2">
              <el-button text class="w-full"><IconHistory :size="17" class="mr-1.5" />История изменений цены</el-button>
            </router-link>
          </div>
        </section>

        <section class="surface p-5">
          <div class="mb-3 flex items-center justify-between">
            <h2 class="font-semibold text-ink">Документы</h2>
            <el-upload v-if="canManage" :show-file-list="false" :http-request="uploadDocument" accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.jpg,.jpeg,.png" :disabled="busy">
              <el-button size="small" text type="primary"><IconUpload :size="16" class="mr-1" />Загрузить</el-button>
            </el-upload>
          </div>
          <ul v-if="property.documents?.length" class="flex flex-col gap-1">
            <li v-for="doc in property.documents" :key="doc.id" class="group flex items-center gap-3 rounded-control px-2 py-2 hover:bg-surface-2">
              <IconFileText :size="20" class="text-accent" />
              <a :href="doc.url" class="min-w-0 flex-1 truncate text-sm text-ink" download>{{ doc.originalName || 'Документ' }}</a>
              <IconDownload :size="16" class="text-subtle" />
              <button v-if="canManage" type="button" class="text-subtle hover:text-danger" aria-label="Удалить документ" @click="removeDocument(doc.id)"><IconTrash :size="16" /></button>
            </li>
          </ul>
          <p v-else class="text-sm text-muted">Документы не загружены.</p>
          <p v-if="canManage" class="mt-3 text-xs text-subtle">PDF, Word, Excel, текст или изображения до 10 МБ.</p>
        </section>
        <p class="px-1 text-xs text-subtle">Добавлен {{ formatDate(property.createdAt) }}</p>
      </aside>
    </div>

    <PropertyFormDialog v-if="property" v-model="editOpen" :property="property" @saved="() => run()" />
    <ApplyDialog v-if="property" v-model="applyOpen" :property="property" />
  </div>
</template>
