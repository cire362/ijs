<script setup lang="ts">
import { ref } from 'vue'
import { IconMailCheck } from '@tabler/icons-vue'
import { authApi } from '@/api/endpoints'
import { errorMessage } from '@/api/http'
import AuthCard from './AuthCard.vue'

const email = ref('')
const loading = ref(false)
const error = ref('')
const sent = ref('')

async function submit () {
  const value = email.value.trim().toLowerCase()
  if (!/^\S+@\S+\.\S+$/.test(value)) { error.value = 'Укажите email, с которым вы регистрировались'; return }
  loading.value = true
  error.value = ''
  try {
    sent.value = (await authApi.forgotPassword(value)).message
  } catch (e) {
    error.value = errorMessage(e, 'Не удалось отправить письмо')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AuthCard title="Восстановление пароля" :subtitle="sent ? undefined : 'Пришлём на почту ссылку для нового пароля.'">
    <div v-if="sent" class="text-center">
      <div class="mx-auto mb-4 grid size-12 place-items-center rounded-surface bg-success-soft text-success"><IconMailCheck :size="24" /></div>
      <p class="text-ink">{{ sent }}</p>
      <p class="mt-2 text-sm text-muted">Ссылка действует 60 минут. Если письма нет, проверьте папку «Спам».</p>
    </div>
    <el-form v-else label-position="top" size="large" @submit.prevent="submit">
      <el-form-item label="Email" :error="error">
        <el-input v-model="email" type="email" autocomplete="email" maxlength="255" />
      </el-form-item>
      <el-button type="primary" native-type="submit" :loading="loading" class="w-full">Отправить ссылку</el-button>
    </el-form>
    <template #footer>
      <router-link to="/login" class="link">Вернуться ко входу</router-link>
    </template>
  </AuthCard>
</template>
