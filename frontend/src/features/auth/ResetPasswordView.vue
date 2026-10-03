<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { authApi } from '@/api/endpoints'
import { errorMessage } from '@/api/http'
import { useAuthStore } from '@/stores/auth'
import AuthCard from './AuthCard.vue'

const router = useRouter()
const auth = useAuthStore()
const token = ref('')
const form = reactive({ password: '', confirm: '' })
const loading = ref(false)
const error = ref('')

// The token arrives in the URL fragment and is removed from the address bar right away.
onMounted(() => {
  const params = new URLSearchParams(window.location.hash.slice(1))
  token.value = params.get('token') ?? ''
  if (window.location.hash) history.replaceState(history.state, '', window.location.pathname)
})

async function submit () {
  error.value = ''
  if (form.password.length < 8) { error.value = 'Пароль должен быть не короче 8 символов'; return }
  if (new TextEncoder().encode(form.password).length > 72) { error.value = 'Пароль слишком длинный'; return }
  if (form.password !== form.confirm) { error.value = 'Пароли не совпадают'; return }
  loading.value = true
  try {
    await authApi.resetPassword(token.value, form.password)
    // All sessions are closed by the server, including this browser's.
    auth.clearLocal()
    ElMessage.success('Пароль изменён. Войдите с новым паролем')
    await router.replace('/login')
  } catch (e) {
    error.value = errorMessage(e, 'Не удалось изменить пароль')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AuthCard title="Новый пароль" :subtitle="token ? 'Придумайте пароль от 8 символов.' : undefined">
    <div v-if="!token" class="text-center">
      <p class="text-ink">Ссылка неполная или уже использована.</p>
      <router-link to="/forgot-password" class="mt-4 inline-block"><el-button type="primary">Запросить новую ссылку</el-button></router-link>
    </div>
    <el-form v-else label-position="top" size="large" @submit.prevent="submit">
      <el-form-item label="Новый пароль"><el-input v-model="form.password" type="password" show-password autocomplete="new-password" maxlength="200" /></el-form-item>
      <el-form-item label="Повторите пароль"><el-input v-model="form.confirm" type="password" show-password autocomplete="new-password" maxlength="200" /></el-form-item>
      <div v-if="error" class="mb-4 rounded-control bg-danger-soft px-3 py-2 text-sm text-danger" role="alert">
        {{ error }}
        <router-link v-if="error.includes('Запросите')" to="/forgot-password" class="link ml-1">Запросить</router-link>
      </div>
      <el-button type="primary" native-type="submit" :loading="loading" class="w-full">Сохранить пароль</el-button>
    </el-form>
  </AuthCard>
</template>
