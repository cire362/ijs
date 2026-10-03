<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { IconBuildingCommunity, IconPlus, IconSearch } from '@tabler/icons-vue'
import { usersApi } from '@/api/endpoints'
import { errorMessage } from '@/api/http'
import type { User } from '@/api/types'
import { useAsync } from '@/composables/useAsync'
import { confirmAction } from '@/composables/confirm'
import { formatDate, formatPhone, isValidRuPhone, personName } from '@/utils/format'
import PageHeader from '@/components/PageHeader.vue'
import EmptyState from '@/components/EmptyState.vue'
import ErrorState from '@/components/ErrorState.vue'
import SkeletonRows from '@/components/SkeletonRows.vue'
import StatusTag from '@/components/StatusTag.vue'

type Status = 'pending' | 'approved' | 'rejected'
const tabs: { value: Status, label: string }[] = [
  { value: 'pending', label: 'На проверке' },
  { value: 'approved', label: 'Подтверждённые' },
  { value: 'rejected', label: 'Отклонённые' }
]
const status = ref<Status>('pending')
const search = ref('')
const busyId = ref<number | null>(null)
const { data, loading, error, run } = useAsync(() => usersApi.developers({ status: status.value, q: search.value.trim() }), [] as User[])
let timer: ReturnType<typeof setTimeout> | undefined
watch([status, search], () => { clearTimeout(timer); timer = setTimeout(() => run(), 250) })
void run()

async function act (dev: User, task: () => Promise<unknown>, success: string) {
  busyId.value = dev.id
  try {
    await task()
    ElMessage.success(success)
    await run()
  } catch (e) {
    ElMessage.error(errorMessage(e))
  } finally {
    busyId.value = null
  }
}
const approve = (dev: User) => act(dev, () => usersApi.approveDeveloper(dev.id), 'Застройщик подтверждён')
async function reject (dev: User) {
  if (!(await confirmAction('Отклонить регистрацию?', 'Сеансы застройщика завершатся, вход будет закрыт. Позже регистрацию можно подтвердить.', 'Отклонить', true))) return
  await act(dev, () => usersApi.rejectDeveloper(dev.id), 'Регистрация отклонена')
}
async function remove (dev: User) {
  if (!(await confirmAction('Удалить заявку застройщика?', 'Аккаунт будет удалён без возможности восстановления.', 'Удалить', true))) return
  await act(dev, () => usersApi.deleteDeveloper(dev.id), 'Аккаунт удалён')
}

const createOpen = ref(false)
const creating = ref(false)
const createError = ref('')
const form = reactive({ companyName: '', lastName: '', firstName: '', middleName: '', email: '', phone: '', password: '' })
async function create () {
  createError.value = ''
  if (!form.companyName.trim()) { createError.value = 'Укажите компанию'; return }
  if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) { createError.value = 'Проверьте email'; return }
  if (!isValidRuPhone(form.phone)) { createError.value = 'Укажите российский телефон'; return }
  if (form.password.length < 8) { createError.value = 'Пароль не короче 8 символов'; return }
  creating.value = true
  try {
    await usersApi.createDeveloper({ ...form, email: form.email.trim().toLowerCase(), phone: formatPhone(form.phone) })
    ElMessage.success('Застройщик создан и подтверждён')
    createOpen.value = false
    Object.assign(form, { companyName: '', lastName: '', firstName: '', middleName: '', email: '', phone: '', password: '' })
    status.value = 'approved'
    await run()
  } catch (e) {
    createError.value = errorMessage(e, 'Не удалось создать застройщика')
  } finally {
    creating.value = false
  }
}
</script>

<template>
  <div>
    <PageHeader title="Застройщики" description="Проверка регистраций и аккаунты застройщиков.">
      <template #actions>
        <el-button type="primary" @click="createOpen = true"><IconPlus :size="18" class="mr-1.5" />Добавить застройщика</el-button>
      </template>
    </PageHeader>
    <div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
      <div class="inline-flex rounded-control bg-surface-2 p-1" role="tablist">
        <button v-for="option in tabs" :key="option.value" type="button" role="tab" :aria-selected="status === option.value" class="rounded-[8px] px-4 py-1.5 text-sm font-medium" :class="status === option.value ? 'bg-surface text-ink shadow-soft' : 'text-muted'" @click="status = option.value">{{ option.label }}</button>
      </div>
      <el-input v-model="search" placeholder="Компания, имя или email" clearable class="sm:max-w-xs" aria-label="Поиск">
        <template #prefix><IconSearch :size="16" /></template>
      </el-input>
    </div>

    <ErrorState v-if="error" :message="error" @retry="run" />
    <SkeletonRows v-else-if="loading && !data.length" :rows="4" />
    <EmptyState v-else-if="!data.length" :icon="IconBuildingCommunity" :title="status === 'pending' ? 'Новых регистраций нет' : 'Список пуст'" />
    <ul v-else class="surface divide-y divide-[var(--border)]">
      <li v-for="dev in data" :key="dev.id" class="flex flex-col gap-3 p-5 md:flex-row md:items-center">
        <div class="min-w-0 flex-1">
          <p class="font-semibold text-ink">{{ dev.companyName || 'Компания не указана' }}</p>
          <p class="text-sm text-muted">{{ personName(dev) }}, {{ dev.email }}<template v-if="dev.phone">, {{ dev.phone }}</template></p>
          <p class="text-xs text-subtle">Регистрация {{ formatDate(dev.createdAt) }}</p>
        </div>
        <StatusTag v-if="dev.developerApproved" tone="success" label="Подтверждён" />
        <StatusTag v-else-if="dev.developerRejected" tone="danger" label="Отклонён" />
        <div class="flex gap-2">
          <el-button v-if="!dev.developerApproved" type="primary" :loading="busyId === dev.id" @click="approve(dev)">Подтвердить</el-button>
          <el-button v-if="!dev.developerApproved && !dev.developerRejected" :disabled="busyId === dev.id" @click="reject(dev)">Отклонить</el-button>
          <el-button v-if="!dev.developerApproved" text type="danger" :disabled="busyId === dev.id" @click="remove(dev)">Удалить</el-button>
        </div>
      </li>
    </ul>

    <el-dialog v-model="createOpen" title="Новый застройщик" width="min(560px, 94vw)" align-center>
      <el-form label-position="top" @submit.prevent="create">
        <el-form-item label="Компания" required><el-input v-model="form.companyName" maxlength="200" /></el-form-item>
        <div class="grid gap-x-3 sm:grid-cols-3">
          <el-form-item label="Фамилия"><el-input v-model="form.lastName" maxlength="100" /></el-form-item>
          <el-form-item label="Имя"><el-input v-model="form.firstName" maxlength="100" /></el-form-item>
          <el-form-item label="Отчество"><el-input v-model="form.middleName" maxlength="100" /></el-form-item>
        </div>
        <div class="grid gap-x-3 sm:grid-cols-2">
          <el-form-item label="Email" required><el-input v-model="form.email" type="email" maxlength="255" autocomplete="off" /></el-form-item>
          <el-form-item label="Телефон" required><el-input v-model="form.phone" type="tel" maxlength="50" placeholder="+7 900 100-00-11" /></el-form-item>
        </div>
        <el-form-item label="Временный пароль" required><el-input v-model="form.password" type="password" show-password maxlength="200" autocomplete="new-password" /></el-form-item>
        <p class="text-xs text-subtle">Передайте пароль застройщику защищённым способом. Он сможет сменить его в профиле или через восстановление пароля.</p>
        <p v-if="createError" class="mt-3 rounded-control bg-danger-soft px-3 py-2 text-sm text-danger" role="alert">{{ createError }}</p>
      </el-form>
      <template #footer>
        <el-button @click="createOpen = false">Отмена</el-button>
        <el-button type="primary" :loading="creating" @click="create">Создать</el-button>
      </template>
    </el-dialog>
  </div>
</template>
