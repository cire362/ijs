<script setup lang="ts">
import { onBeforeUnmount } from 'vue'
import { IconFileText } from '@tabler/icons-vue'
import { applicationsApi } from '@/api/endpoints'
import { useAuthStore } from '@/stores/auth'
import { APPLICATION_STATUS } from '@/utils/status'
import PageHeader from '@/components/PageHeader.vue'
import EmptyState from '@/components/EmptyState.vue'
import ErrorState from '@/components/ErrorState.vue'
import SkeletonRows from '@/components/SkeletonRows.vue'
import ApplicationsTable from './ApplicationsTable.vue'
import ApplicationDrawer from './ApplicationDrawer.vue'
import { PAGE_SIZE, useApplicationList } from './useApplicationList'

const auth = useAuthStore()
const list = useApplicationList((query) => applicationsApi.mine(query))
const { data, loading, error, run, page, status, selected, drawer, open } = list
onBeforeUnmount(() => list.stop())
</script>

<template>
  <div>
    <PageHeader title="Мои заявки" :description="auth.role === 'agent' ? 'Заявки за клиентов: статус, срок, комиссия и переписка.' : 'Ваши заявки на объекты и их статус.'">
      <template #actions>
        <el-select v-model="status" placeholder="Все статусы" clearable class="w-56" aria-label="Статус">
          <el-option v-for="(meta, value) in APPLICATION_STATUS" :key="value" :value="value" :label="meta.label" />
        </el-select>
        <router-link to="/properties"><el-button type="primary">Новая заявка</el-button></router-link>
      </template>
    </PageHeader>

    <ErrorState v-if="error" :message="error" @retry="run" />
    <SkeletonRows v-else-if="loading && !data.items.length" :rows="6" height="56px" />
    <EmptyState v-else-if="!data.items.length" :icon="IconFileText" :title="status ? 'Заявок с таким статусом нет' : 'Заявок пока нет'" text="Выберите объект в каталоге и подайте заявку из его карточки.">
      <router-link to="/properties"><el-button type="primary">Открыть каталог</el-button></router-link>
    </EmptyState>
    <div v-else :class="{ 'opacity-60': loading }" class="transition-opacity">
      <ApplicationsTable :items="data.items" :show-client="auth.role === 'agent'" @open="open" />
      <el-pagination v-if="data.total > PAGE_SIZE" v-model:current-page="page" class="mt-6 justify-center" layout="prev, pager, next" :page-size="PAGE_SIZE" :total="data.total" background />
    </div>

    <ApplicationDrawer v-model="drawer" :application="selected" @changed="run" />
  </div>
</template>
