<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { IconInbox } from '@tabler/icons-vue'
import { applicationsApi, usersApi } from '@/api/endpoints'
import type { User } from '@/api/types'
import { useAuthStore } from '@/stores/auth'
import { personName } from '@/utils/format'
import { APPLICATION_STATUS } from '@/utils/status'
import PageHeader from '@/components/PageHeader.vue'
import EmptyState from '@/components/EmptyState.vue'
import ErrorState from '@/components/ErrorState.vue'
import SkeletonRows from '@/components/SkeletonRows.vue'
import ApplicationsTable from './ApplicationsTable.vue'
import ApplicationDrawer from './ApplicationDrawer.vue'
import { PAGE_SIZE, useApplicationList } from './useApplicationList'

const auth = useAuthStore()
const list = useApplicationList((query) => applicationsApi.incoming({ ...query, developerId: auth.isAdmin ? query.developerId : undefined }))
const { data, loading, error, run, page, status, developerId, selected, drawer, open } = list
const developers = ref<User[]>([])
onMounted(async () => { if (auth.isAdmin) developers.value = await usersApi.developers({ status: 'approved' }).catch(() => []) })
onBeforeUnmount(() => list.stop())
</script>

<template>
  <div>
    <PageHeader title="Входящие заявки" :description="auth.isAdmin ? 'Заявки по всем застройщикам.' : 'Заявки агентов и покупателей на ваши объекты.'">
      <template #actions>
        <el-select v-if="auth.isAdmin" v-model="developerId" placeholder="Все застройщики" clearable filterable class="w-60" aria-label="Застройщик">
          <el-option v-for="dev in developers" :key="dev.id" :value="dev.id" :label="dev.companyName || personName(dev)" />
        </el-select>
        <el-select v-model="status" placeholder="Все статусы" clearable class="w-56" aria-label="Статус">
          <el-option v-for="(meta, value) in APPLICATION_STATUS" :key="value" :value="value" :label="meta.label" />
        </el-select>
      </template>
    </PageHeader>

    <ErrorState v-if="error" :message="error" @retry="run" />
    <SkeletonRows v-else-if="loading && !data.items.length" :rows="6" height="56px" />
    <EmptyState v-else-if="!data.items.length" :icon="IconInbox" :title="status || developerId ? 'По этим условиям заявок нет' : 'Заявок пока нет'" text="Новые заявки появятся здесь, а уведомление придёт сразу после отправки." />
    <div v-else :class="{ 'opacity-60': loading }" class="transition-opacity">
      <ApplicationsTable :items="data.items" show-agent show-client @open="open" />
      <el-pagination v-if="data.total > PAGE_SIZE" v-model:current-page="page" class="mt-6 justify-center" layout="prev, pager, next" :page-size="PAGE_SIZE" :total="data.total" background />
    </div>

    <ApplicationDrawer v-model="drawer" :application="selected" @changed="run" />
  </div>
</template>
