<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import type { UploadRequestOptions } from 'element-plus'
import { IconCamera } from '@tabler/icons-vue'
import { usersApi } from '@/api/endpoints'
import { errorMessage } from '@/api/http'
import { LEGAL_DOC_VERSION } from '@/config/brand'
import { confirmAction } from '@/composables/confirm'
import { useAuthStore } from '@/stores/auth'
import { formatDate, formatPhone, isValidRuPhone } from '@/utils/format'
import { ROLE_LABEL } from '@/utils/status'
import PageHeader from '@/components/PageHeader.vue'
import UserAvatar from '@/components/UserAvatar.vue'
import StatusTag from '@/components/StatusTag.vue'

const auth = useAuthStore()
const router = useRouter()
const user = computed(() => auth.user!)
const needsCompany = computed(() => user.value.role === 'agent' || user.value.role === 'developer')

const profile = reactive({
  lastName: user.value.lastName ?? '',
  firstName: user.value.firstName ?? '',
  middleName: user.value.middleName ?? '',
  email: user.value.email,
  phone: user.value.phone ?? '',
  companyName: user.value.companyName ?? ''
})
// Login responses omit some fields (e.g. the registration date); the full profile is loaded here.
onMounted(() => { void auth.reload().catch(() => {}) })

const savingProfile = ref(false)
const profileError = ref('')

async function saveProfile () {
  profileError.value = ''
  if (!/^\S+@\S+\.\S+$/.test(profile.email.trim())) { profileError.value = 'Проверьте email'; return }
  if (profile.phone.trim() && profile.phone !== user.value.phone && !isValidRuPhone(profile.phone)) { profileError.value = 'Укажите российский телефон, например +7 900 100-00-11'; return }
  if (needsCompany.value && !profile.companyName.trim()) { profileError.value = 'Укажите компанию'; return }
  savingProfile.value = true
  try {
    const updated = await usersApi.updateMe({
      lastName: profile.lastName.trim(),
      firstName: profile.firstName.trim(),
      middleName: profile.middleName.trim(),
      email: profile.email.trim().toLowerCase(),
      phone: profile.phone === user.value.phone ? profile.phone : formatPhone(profile.phone.trim()),
      companyName: profile.companyName.trim()
    })
    auth.setUser(updated)
    profile.phone = updated.phone ?? ''
    ElMessage.success('Профиль сохранён')
  } catch (e) {
    profileError.value = errorMessage(e, 'Не удалось сохранить профиль')
  } finally {
    savingProfile.value = false
  }
}

const avatarBusy = ref(false)
async function uploadAvatar (options: UploadRequestOptions) {
  if (options.file.size > 2 * 1024 * 1024) { ElMessage.error('Фото больше 2 МБ'); return }
  avatarBusy.value = true
  try {
    auth.setUser(await usersApi.uploadAvatar(options.file))
    ElMessage.success('Фото обновлено')
  } catch (e) {
    ElMessage.error(errorMessage(e))
  } finally {
    avatarBusy.value = false
  }
}

const password = reactive({ current: '', next: '', confirm: '' })
const savingPassword = ref(false)
const passwordError = ref('')
async function changePassword () {
  passwordError.value = ''
  if (!password.current) { passwordError.value = 'Укажите текущий пароль'; return }
  if (password.next.length < 8) { passwordError.value = 'Новый пароль не короче 8 символов'; return }
  if (new TextEncoder().encode(password.next).length > 72) { passwordError.value = 'Новый пароль слишком длинный'; return }
  if (password.next !== password.confirm) { passwordError.value = 'Пароли не совпадают'; return }
  savingPassword.value = true
  try {
    await usersApi.changePassword(password.current, password.next)
    Object.assign(password, { current: '', next: '', confirm: '' })
    ElMessage.success('Пароль изменён. Остальные устройства потребуют войти заново')
  } catch (e) {
    passwordError.value = errorMessage(e, 'Не удалось изменить пароль')
  } finally {
    savingPassword.value = false
  }
}

async function logoutEverywhere () {
  if (!(await confirmAction('Выйти на всех устройствах?', 'Потребуется войти заново везде, включая это устройство.', 'Выйти везде'))) return
  await auth.logout(true).catch(() => {})
  await router.push('/login')
}

const consentBusy = ref(false)
async function setMarketing (accepted: boolean) {
  consentBusy.value = true
  try {
    auth.setUser(await usersApi.setMarketingConsent(accepted, LEGAL_DOC_VERSION))
    ElMessage.success(accepted ? 'Согласие на рассылку дано' : 'Согласие на рассылку отозвано')
  } catch (e) {
    ElMessage.error(errorMessage(e))
  } finally {
    consentBusy.value = false
  }
}

const deleteOpen = ref(false)
const deletePassword = ref('')
const deleting = ref(false)
const deleteError = ref('')
async function deleteAccount () {
  deleteError.value = ''
  if (!deletePassword.value) { deleteError.value = 'Введите пароль'; return }
  deleting.value = true
  try {
    await usersApi.deleteMe(deletePassword.value)
    auth.clearLocal()
    ElMessage.success('Аккаунт удалён')
    await router.replace('/')
  } catch (e) {
    deleteError.value = errorMessage(e, 'Не удалось удалить аккаунт')
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <div class="max-w-5xl">
    <PageHeader title="Профиль" />

    <section class="grid gap-6 border-b border-line pb-10 md:grid-cols-[260px_1fr]">
      <div>
        <h2 class="font-semibold text-ink">Личные данные</h2>
        <p class="mt-1 text-sm text-muted">Видны застройщику и администратору в ваших заявках.</p>
      </div>
      <div class="surface p-6">
        <div class="mb-6 flex items-center gap-4">
          <div class="relative">
            <UserAvatar :person="user" :src="user.avatarUrl" :size="72" />
            <el-upload :show-file-list="false" :http-request="uploadAvatar" accept="image/jpeg,image/png,image/webp" :disabled="avatarBusy" class="absolute -bottom-1 -right-1">
              <button type="button" class="grid size-8 place-items-center rounded-full bg-accent text-accent-contrast shadow-soft" aria-label="Загрузить фото"><IconCamera :size="16" /></button>
            </el-upload>
          </div>
          <div>
            <p class="font-medium text-ink">{{ ROLE_LABEL[user.role] }}</p>
            <p v-if="user.createdAt" class="text-sm text-muted">На платформе с {{ formatDate(user.createdAt) }}</p>
            <StatusTag v-if="auth.isPendingDeveloper" class="mt-1" tone="warning" label="Ожидает подтверждения" />
          </div>
        </div>
        <el-form label-position="top" @submit.prevent="saveProfile">
          <div class="grid gap-x-4 sm:grid-cols-3">
            <el-form-item label="Фамилия"><el-input v-model="profile.lastName" maxlength="100" autocomplete="family-name" /></el-form-item>
            <el-form-item label="Имя"><el-input v-model="profile.firstName" maxlength="100" autocomplete="given-name" /></el-form-item>
            <el-form-item label="Отчество"><el-input v-model="profile.middleName" maxlength="100" autocomplete="additional-name" /></el-form-item>
          </div>
          <div class="grid gap-x-4 sm:grid-cols-2">
            <el-form-item label="Email"><el-input v-model="profile.email" type="email" maxlength="255" autocomplete="email" /></el-form-item>
            <el-form-item label="Телефон"><el-input v-model="profile.phone" type="tel" maxlength="50" placeholder="+7 900 100-00-11" autocomplete="tel" /></el-form-item>
          </div>
          <el-form-item v-if="needsCompany" :label="user.role === 'developer' ? 'Компания-застройщик' : 'Агентство'"><el-input v-model="profile.companyName" maxlength="200" autocomplete="organization" /></el-form-item>
          <p v-if="user.role === 'individual'" class="-mt-1 mb-4 text-xs text-subtle">ФИО и телефон подставляются в ваши заявки на объекты.</p>
          <p v-if="profileError" class="mb-4 rounded-control bg-danger-soft px-3 py-2 text-sm text-danger" role="alert">{{ profileError }}</p>
          <el-button type="primary" native-type="submit" :loading="savingProfile">Сохранить</el-button>
        </el-form>
      </div>
    </section>

    <section class="grid gap-6 border-b border-line py-10 md:grid-cols-[260px_1fr]">
      <div>
        <h2 class="font-semibold text-ink">Безопасность</h2>
        <p class="mt-1 text-sm text-muted">После смены пароля остальные устройства выйдут из аккаунта.</p>
      </div>
      <div class="surface p-6">
        <el-form label-position="top" class="max-w-md" @submit.prevent="changePassword">
          <el-form-item label="Текущий пароль"><el-input v-model="password.current" type="password" show-password autocomplete="current-password" maxlength="200" /></el-form-item>
          <el-form-item label="Новый пароль"><el-input v-model="password.next" type="password" show-password autocomplete="new-password" maxlength="200" /></el-form-item>
          <el-form-item label="Повторите новый пароль"><el-input v-model="password.confirm" type="password" show-password autocomplete="new-password" maxlength="200" /></el-form-item>
          <p v-if="passwordError" class="mb-4 rounded-control bg-danger-soft px-3 py-2 text-sm text-danger" role="alert">{{ passwordError }}</p>
          <div class="flex flex-wrap gap-2">
            <el-button type="primary" native-type="submit" :loading="savingPassword">Изменить пароль</el-button>
            <el-button @click="logoutEverywhere">Выйти на всех устройствах</el-button>
          </div>
        </el-form>
      </div>
    </section>

    <section class="grid gap-6 border-b border-line py-10 md:grid-cols-[260px_1fr]">
      <div>
        <h2 class="font-semibold text-ink">Согласия</h2>
        <p class="mt-1 text-sm text-muted">Документы доступны в разделе <router-link to="/legal" class="link">правовой информации</router-link>.</p>
      </div>
      <div class="surface divide-y divide-[var(--border)]">
        <div class="p-5">
          <p class="font-medium text-ink">Пользовательское соглашение и обработка персональных данных</p>
          <p class="mt-1 text-sm text-muted">
            <template v-if="user.legalConsentAcceptedAt">Принято {{ formatDate(user.legalConsentAcceptedAt) }}<template v-if="user.legalConsentVersion">, редакция {{ user.legalConsentVersion }}</template>.</template>
            <template v-else>Дата принятия не записана.</template>
          </p>
        </div>
        <div class="flex items-start justify-between gap-4 p-5">
          <div>
            <p class="font-medium text-ink">Информационные и рекламные рассылки</p>
            <p class="mt-1 text-sm text-muted">
              <template v-if="user.marketingConsentGiven">Согласие дано {{ formatDate(user.marketingConsentAcceptedAt) }}.</template>
              <template v-else-if="user.marketingConsentWithdrawnAt">Согласие отозвано {{ formatDate(user.marketingConsentWithdrawnAt) }}.</template>
              <template v-else>Согласие не давалось.</template>
            </p>
          </div>
          <el-switch :model-value="user.marketingConsentGiven" :loading="consentBusy" aria-label="Согласие на рассылки" @change="(value) => setMarketing(Boolean(value))" />
        </div>
      </div>
    </section>

    <section class="grid gap-6 py-10 md:grid-cols-[260px_1fr]">
      <div>
        <h2 class="font-semibold text-danger">Удаление аккаунта</h2>
        <p class="mt-1 text-sm text-muted">По вашему требованию персональные данные будут обезличены.</p>
      </div>
      <div class="surface border-[color-mix(in_srgb,var(--danger)_35%,var(--border))] p-6">
        <p class="text-[15px] text-ink">Будут удалены ФИО, телефон, email, фото, уведомления и записи на будущие мероприятия. Отправленные заявки отзовутся. История завершённых сделок сохранится без ваших данных.</p>
        <p class="mt-2 text-sm text-muted">Удалить аккаунт нельзя, пока есть сделки в работе{{ user.role === 'developer' ? ' или объекты' : '' }}.</p>
        <el-button class="mt-4" type="danger" plain @click="deleteOpen = true">Удалить аккаунт</el-button>
      </div>
    </section>

    <el-dialog v-model="deleteOpen" title="Удалить аккаунт?" width="min(440px, 94vw)" align-center @closed="deletePassword = ''; deleteError = ''">
      <p class="text-[15px] text-ink">Действие необратимо. Для подтверждения введите пароль.</p>
      <el-form class="mt-4" label-position="top" @submit.prevent="deleteAccount">
        <el-form-item label="Пароль"><el-input v-model="deletePassword" type="password" show-password autocomplete="current-password" maxlength="200" /></el-form-item>
        <p v-if="deleteError" class="rounded-control bg-danger-soft px-3 py-2 text-sm text-danger" role="alert">{{ deleteError }}</p>
      </el-form>
      <template #footer>
        <el-button @click="deleteOpen = false">Отмена</el-button>
        <el-button type="danger" :loading="deleting" @click="deleteAccount">Удалить навсегда</el-button>
      </template>
    </el-dialog>
  </div>
</template>
