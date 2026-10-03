<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { IconNews, IconPlus, IconSearch } from '@tabler/icons-vue'
import { newsApi } from '@/api/endpoints'
import type { NewsItem, Page } from '@/api/types'
import { useAsync } from '@/composables/useAsync'
import { useAuthStore } from '@/stores/auth'
import { formatDate } from '@/utils/format'
import PageHeader from '@/components/PageHeader.vue'
import EmptyState from '@/components/EmptyState.vue'
import ErrorState from '@/components/ErrorState.vue'
import StatusTag from '@/components/StatusTag.vue'
import NewsEditorDialog from './NewsEditorDialog.vue'

const PAGE_SIZE = 10
const auth = useAuthStore()
const router = useRouter()
const page = ref(1)
const search = ref('')
const published = ref<'' | 'true' | 'false'>('')
const editorOpen = ref(false)

const { data, loading, error, run } = useAsync(
  () => newsApi.list({ page: page.value, limit: PAGE_SIZE, q: search.value.trim(), published: published.value === '' ? null : published.value === 'true' }),
  { items: [], total: 0, page: 1, limit: PAGE_SIZE } as Page<NewsItem>
)
let timer: ReturnType<typeof setTimeout> | undefined
watch([search, published], () => { clearTimeout(timer); timer = setTimeout(() => { page.value = 1; void run() }, 300) })
watch(page, () => run())
void run()

const lead = computed(() => page.value === 1 && !search.value ? data.value.items[0] ?? null : null)
const rest = computed(() => lead.value ? data.value.items.slice(1) : data.value.items)
</script>

<template>
  <div :class="{ 'mx-auto max-w-6xl px-4 py-10 md:px-8': !auth.user }">
    <PageHeader title="Новости" description="Обновления платформы, условия застройщиков и анонсы.">
      <template #actions>
        <el-input v-model="search" placeholder="Поиск" clearable class="w-56" aria-label="Поиск новостей">
          <template #prefix><IconSearch :size="16" /></template>
        </el-input>
        <template v-if="auth.isAdmin">
          <el-select v-model="published" class="w-40" aria-label="Публикация">
            <el-option value="" label="Все" />
            <el-option value="true" label="Опубликованные" />
            <el-option value="false" label="Черновики" />
          </el-select>
          <el-button type="primary" @click="editorOpen = true"><IconPlus :size="18" class="mr-1.5" />Новость</el-button>
        </template>
      </template>
    </PageHeader>

    <ErrorState v-if="error" :message="error" @retry="run" />
    <div v-else-if="loading && !data.items.length" class="grid gap-6 lg:grid-cols-2">
      <div class="skeleton aspect-[16/9] rounded-surface" />
      <div class="flex flex-col gap-4"><div v-for="i in 3" :key="i" class="skeleton h-24 rounded-surface" /></div>
    </div>
    <EmptyState v-else-if="!data.items.length" :icon="IconNews" :title="search ? 'Ничего не найдено' : 'Новостей пока нет'" />
    <div v-else :class="{ 'opacity-60': loading }">
      <router-link v-if="lead" :to="`/news/${lead.id}`" class="group surface mb-8 grid overflow-hidden md:grid-cols-[1.2fr_1fr]">
        <div class="aspect-[16/10] bg-surface-2 md:aspect-auto">
          <img v-if="lead.images?.[0]" :src="lead.images[0].url" alt="" class="size-full object-cover transition-transform duration-500 group-hover:scale-[1.02]">
          <div v-else class="grid size-full min-h-48 place-items-center text-subtle"><IconNews :size="40" /></div>
        </div>
        <div class="flex flex-col justify-center p-6 md:p-8">
          <p class="text-sm text-muted">{{ formatDate(lead.publishedAt || lead.createdAt) }}</p>
          <h2 class="mt-2 text-2xl font-semibold text-ink group-hover:text-accent md:text-3xl">{{ lead.title }}</h2>
          <p v-if="lead.excerpt || lead.subtitle" class="mt-3 line-clamp-4 text-muted">{{ lead.excerpt || lead.subtitle }}</p>
          <StatusTag v-if="!lead.isPublished" class="mt-4 self-start" tone="warning" label="Черновик" />
        </div>
      </router-link>
      <ul class="grid gap-x-8 md:grid-cols-2">
        <li v-for="item in rest" :key="item.id" class="border-t border-line">
          <button type="button" class="group flex w-full gap-4 py-5 text-left" @click="router.push(`/news/${item.id}`)">
            <img v-if="item.images?.[0]" :src="item.images[0].url" alt="" loading="lazy" class="size-20 shrink-0 rounded-control object-cover">
            <span class="min-w-0">
              <span class="flex items-center gap-2 text-xs text-subtle">{{ formatDate(item.publishedAt || item.createdAt) }}<StatusTag v-if="!item.isPublished" tone="warning" label="Черновик" /></span>
              <span class="mt-1 block font-semibold text-ink group-hover:text-accent">{{ item.title }}</span>
              <span v-if="item.excerpt || item.subtitle" class="mt-1 line-clamp-2 block text-sm text-muted">{{ item.excerpt || item.subtitle }}</span>
            </span>
          </button>
        </li>
      </ul>
      <el-pagination v-if="data.total > PAGE_SIZE" v-model:current-page="page" class="mt-6 justify-center" layout="prev, pager, next" :page-size="PAGE_SIZE" :total="data.total" background />
    </div>

    <NewsEditorDialog v-model="editorOpen" @saved="(item) => router.push(`/news/${item.id}`)" />
  </div>
</template>
