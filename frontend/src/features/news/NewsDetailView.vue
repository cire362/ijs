<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { IconArrowLeft, IconEdit } from '@tabler/icons-vue'
import { newsApi } from '@/api/endpoints'
import type { NewsItem } from '@/api/types'
import { useAsync } from '@/composables/useAsync'
import { useAuthStore } from '@/stores/auth'
import { formatDate } from '@/utils/format'
import ErrorState from '@/components/ErrorState.vue'
import SkeletonRows from '@/components/SkeletonRows.vue'
import StatusTag from '@/components/StatusTag.vue'
import NewsEditorDialog from './NewsEditorDialog.vue'

const route = useRoute()
const auth = useAuthStore()
const id = computed(() => Number(route.params.id))
const editorOpen = ref(false)
const { data: item, loading, error, run } = useAsync(() => newsApi.get(id.value), null as NewsItem | null)
watch(id, () => run(), { immediate: true })
watch(item, (value) => { if (value) document.title = `${value.title} | ${document.title.split(' | ').pop()}` })
</script>

<template>
  <article class="mx-auto max-w-3xl" :class="{ 'px-4 py-10 md:px-8': !auth.user }">
    <router-link to="/news" class="mb-6 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"><IconArrowLeft :size="16" />Все новости</router-link>
    <ErrorState v-if="error" :message="error" @retry="run" />
    <SkeletonRows v-else-if="loading && !item" :rows="4" height="80px" />
    <template v-else-if="item">
      <header>
        <div class="flex flex-wrap items-center gap-3 text-sm text-muted">
          <time :datetime="item.publishedAt || item.createdAt">{{ formatDate(item.publishedAt || item.createdAt) }}</time>
          <StatusTag v-if="!item.isPublished" tone="warning" label="Черновик" />
          <el-button v-if="auth.isAdmin" size="small" class="ml-auto" @click="editorOpen = true"><IconEdit :size="16" class="mr-1" />Редактировать</el-button>
        </div>
        <h1 class="mt-3 text-3xl font-semibold leading-tight text-ink md:text-4xl">{{ item.title }}</h1>
        <p v-if="item.subtitle" class="mt-3 text-lg text-muted">{{ item.subtitle }}</p>
      </header>
      <img v-if="item.images?.[0]" :src="item.images[0].url" :alt="item.images[0].caption || ''" class="mt-8 w-full rounded-surface object-cover">
      <div class="mt-8 whitespace-pre-line text-[17px] leading-[1.7] text-ink">{{ item.content }}</div>
      <div v-if="(item.images?.length ?? 0) > 1" class="mt-8 grid grid-cols-2 gap-3 md:grid-cols-3">
        <a v-for="image in item.images!.slice(1)" :key="image.id" :href="image.url" target="_blank" rel="noopener">
          <img :src="image.url" :alt="image.caption || ''" loading="lazy" class="aspect-[4/3] w-full rounded-control object-cover">
        </a>
      </div>
    </template>
    <NewsEditorDialog v-model="editorOpen" :item="item" @saved="() => run()" />
  </article>
</template>
