<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import type { FormInstance, FormRules } from 'element-plus'
import { errorMessage } from '@/api/http'
import { LEGAL_DOC_VERSION, PRIVACY_PATH, TERMS_PATH } from '@/config/brand'
import { homeFor } from '@/router'
import { useAuthStore } from '@/stores/auth'
import { formatPhone, isValidRuPhone } from '@/utils/format'
import AuthCard from './AuthCard.vue'

type Role = 'agent' | 'individual' | 'developer'

const auth = useAuthStore()
const router = useRouter()
const formRef = ref<FormInstance>()
const loading = ref(false)
const error = ref('')
const form = reactive({
  role: 'agent' as Role,
  lastName: '',
  firstName: '',
  middleName: '',
  companyName: '',
  email: '',
  phone: '',
  password: '',
  confirmPassword: '',
  agreeLegal: false,
  agreeMarketing: false
})

const roles: { value: Role, label: string, hint: string }[] = [
  { value: 'agent', label: 'Агент', hint: 'Подаю заявки за клиентов' },
  { value: 'individual', label: 'Покупатель', hint: 'Ищу дом для себя' },
  { value: 'developer', label: 'Застройщик', hint: 'Размещаю объекты' }
]
const needsCompany = computed(() => form.role !== 'individual')

const rules: FormRules = {
  lastName: [{ required: true, message: 'Укажите фамилию', trigger: 'blur' }],
  firstName: [{ required: true, message: 'Укажите имя', trigger: 'blur' }],
  companyName: [{ validator: (_r, value: string, cb) => (needsCompany.value && !value.trim() ? cb(new Error('Укажите компанию')) : cb()), trigger: 'blur' }],
  email: [{ required: true, message: 'Укажите email', trigger: 'blur' }, { type: 'email', message: 'Проверьте email', trigger: 'blur' }],
  phone: [{ validator: (_r, value: string, cb) => (isValidRuPhone(value) ? cb() : cb(new Error('Например, +7 900 100-00-11'))), trigger: 'blur' }],
  password: [{ validator: (_r, value: string, cb) => {
    if (value.length < 8) return cb(new Error('Не менее 8 символов'))
    if (new TextEncoder().encode(value).length > 72) return cb(new Error('Пароль слишком длинный'))
    cb()
  }, trigger: 'blur' }],
  confirmPassword: [{ validator: (_r, value: string, cb) => (value === form.password ? cb() : cb(new Error('Пароли не совпадают'))), trigger: 'blur' }],
  agreeLegal: [{ validator: (_r, value: boolean, cb) => (value ? cb() : cb(new Error('Необходимо согласие'))), trigger: 'change' }]
}

async function submit () {
  if (!(await formRef.value?.validate().catch(() => false))) return
  loading.value = true
  error.value = ''
  const acceptedAt = new Date().toISOString()
  try {
    await auth.register({
      role: form.role,
      lastName: form.lastName.trim(),
      firstName: form.firstName.trim(),
      middleName: form.middleName.trim(),
      companyName: needsCompany.value ? form.companyName.trim() : '',
      email: form.email.trim().toLowerCase(),
      phone: formatPhone(form.phone),
      password: form.password,
      consent: {
        legal: { accepted: true, acceptedAt, documentVersion: LEGAL_DOC_VERSION, termsPath: TERMS_PATH, privacyPath: PRIVACY_PATH },
        marketing: { accepted: form.agreeMarketing, acceptedAt: form.agreeMarketing ? acceptedAt : null, documentVersion: LEGAL_DOC_VERSION }
      }
    })
    await router.replace(homeFor(auth.role, auth.user?.developerApproved))
  } catch (e) {
    error.value = errorMessage(e, 'Не удалось зарегистрироваться')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AuthCard title="Регистрация" subtitle="Выберите, как вы будете работать на платформе.">
    <el-form ref="formRef" :model="form" :rules="rules" label-position="top" size="large" @submit.prevent="submit">
      <fieldset class="mb-5 grid grid-cols-3 gap-2" aria-label="Роль">
        <label v-for="option in roles" :key="option.value" class="press cursor-pointer rounded-control border px-3 py-2.5 transition-colors" :class="form.role === option.value ? 'border-accent bg-accent-soft' : 'border-line hover:border-line-strong'">
          <input v-model="form.role" type="radio" :value="option.value" class="sr-only">
          <span class="block text-sm font-semibold" :class="form.role === option.value ? 'text-accent' : 'text-ink'">{{ option.label }}</span>
          <span class="mt-0.5 block text-xs leading-snug text-muted">{{ option.hint }}</span>
        </label>
      </fieldset>
      <p v-if="form.role === 'developer'" class="-mt-2 mb-4 text-sm text-muted">Аккаунт застройщика проверяет администратор. До подтверждения объекты и заявки недоступны.</p>
      <div class="grid gap-x-3 sm:grid-cols-2">
        <el-form-item label="Фамилия" prop="lastName"><el-input v-model="form.lastName" autocomplete="family-name" maxlength="100" /></el-form-item>
        <el-form-item label="Имя" prop="firstName"><el-input v-model="form.firstName" autocomplete="given-name" maxlength="100" /></el-form-item>
      </div>
      <el-form-item label="Отчество"><el-input v-model="form.middleName" autocomplete="additional-name" maxlength="100" /></el-form-item>
      <el-form-item v-if="needsCompany" :label="form.role === 'developer' ? 'Компания-застройщик' : 'Агентство'" prop="companyName"><el-input v-model="form.companyName" autocomplete="organization" maxlength="200" /></el-form-item>
      <el-form-item label="Email" prop="email"><el-input v-model="form.email" type="email" autocomplete="email" maxlength="255" /></el-form-item>
      <el-form-item label="Телефон" prop="phone"><el-input v-model="form.phone" type="tel" autocomplete="tel" maxlength="50" placeholder="+7 900 100-00-11" @blur="form.phone = formatPhone(form.phone)" /></el-form-item>
      <div class="grid gap-x-3 sm:grid-cols-2">
        <el-form-item label="Пароль" prop="password"><el-input v-model="form.password" type="password" show-password autocomplete="new-password" maxlength="200" /></el-form-item>
        <el-form-item label="Повторите пароль" prop="confirmPassword"><el-input v-model="form.confirmPassword" type="password" show-password autocomplete="new-password" maxlength="200" /></el-form-item>
      </div>
      <el-form-item prop="agreeLegal" class="consent">
        <el-checkbox v-model="form.agreeLegal">
          Я принимаю условия
          <router-link to="/legal?tab=terms" target="_blank" class="link">Пользовательского соглашения</router-link>
          и даю согласие на обработку моих персональных данных в соответствии с
          <router-link to="/legal?tab=privacy" target="_blank" class="link">Политикой конфиденциальности</router-link>
        </el-checkbox>
      </el-form-item>
      <el-form-item class="consent">
        <el-checkbox v-model="form.agreeMarketing">Я даю согласие на получение информационных и рекламных рассылок (новости сервиса, анонсы вебинаров).</el-checkbox>
        <p class="mt-1 pl-6 text-xs text-subtle">Согласие на рассылку можно отозвать в профиле или обратившись в поддержку.</p>
      </el-form-item>
      <p v-if="error" class="mb-4 rounded-control bg-danger-soft px-3 py-2 text-sm text-danger" role="alert">{{ error }}</p>
      <el-button type="primary" native-type="submit" :loading="loading" class="w-full">Создать аккаунт</el-button>
    </el-form>
    <template #footer>
      Уже есть аккаунт? <router-link to="/login" class="link font-medium">Войдите</router-link>
    </template>
  </AuthCard>
</template>

<style scoped>
.consent :deep(.el-checkbox) { height: auto; align-items: flex-start; white-space: normal; }
.consent :deep(.el-checkbox__label) { line-height: 1.5; font-size: 14px; color: var(--text-muted); }
.consent :deep(.el-checkbox__input) { margin-top: 3px; }
</style>
