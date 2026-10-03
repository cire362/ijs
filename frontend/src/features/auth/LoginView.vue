<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { FormInstance, FormRules } from 'element-plus'
import { errorMessage } from '@/api/http'
import { homeFor } from '@/router'
import { useAuthStore } from '@/stores/auth'
import AuthCard from './AuthCard.vue'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const formRef = ref<FormInstance>()
const form = reactive({ email: '', password: '' })
const loading = ref(false)
const error = ref('')

// Links from the previous frontend opened registration as a tab of this page.
if (route.query.tab === 'register') void router.replace('/register')

const rules: FormRules = {
  email: [{ required: true, message: 'Укажите email', trigger: 'blur' }, { type: 'email', message: 'Проверьте email', trigger: 'blur' }],
  password: [{ required: true, message: 'Укажите пароль', trigger: 'blur' }]
}

async function submit () {
  if (!(await formRef.value?.validate().catch(() => false))) return
  loading.value = true
  error.value = ''
  try {
    await auth.login(form.email.trim().toLowerCase(), form.password)
    const redirect = typeof route.query.redirect === 'string' && route.query.redirect.startsWith('/') ? route.query.redirect : null
    await router.replace(redirect ?? homeFor(auth.role, auth.user?.developerApproved))
  } catch (e) {
    error.value = errorMessage(e, 'Не удалось войти')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AuthCard title="Вход в кабинет" subtitle="Агенты, покупатели и застройщики работают в одном кабинете.">
    <el-form ref="formRef" :model="form" :rules="rules" label-position="top" size="large" @submit.prevent="submit">
      <el-form-item label="Email" prop="email">
        <el-input v-model="form.email" type="email" autocomplete="email" maxlength="255" />
      </el-form-item>
      <el-form-item label="Пароль" prop="password">
        <el-input v-model="form.password" type="password" show-password autocomplete="current-password" maxlength="200" />
      </el-form-item>
      <div class="-mt-2 mb-4 text-right">
        <router-link to="/forgot-password" class="link text-sm">Забыли пароль?</router-link>
      </div>
      <p v-if="error" class="mb-4 rounded-control bg-danger-soft px-3 py-2 text-sm text-danger" role="alert">{{ error }}</p>
      <el-button type="primary" native-type="submit" :loading="loading" class="w-full">Войти</el-button>
    </el-form>
    <template #footer>
      Нет аккаунта? <router-link to="/register" class="link font-medium">Зарегистрируйтесь</router-link>
    </template>
  </AuthCard>
</template>
