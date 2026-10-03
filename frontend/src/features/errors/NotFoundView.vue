<script setup lang="ts">
import { IconMapOff } from '@tabler/icons-vue'
import { homeFor } from '@/router'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
</script>

<template>
  <div class="mx-auto flex max-w-lg flex-col items-center px-4 py-24 text-center">
    <div class="mb-5 grid size-14 place-items-center rounded-surface bg-accent-soft text-accent"><IconMapOff :size="28" /></div>
    <h1 class="text-3xl font-semibold text-ink">Страница не найдена</h1>
    <p class="mt-3 text-muted">Ссылка устарела или в адресе ошибка. Вернитесь на главную или в кабинет.</p>
    <div class="mt-8 flex gap-3">
      <router-link to="/"><el-button>На главную</el-button></router-link>
      <router-link v-if="auth.user" :to="homeFor(auth.role, auth.user.developerApproved)"><el-button type="primary">В кабинет</el-button></router-link>
    </div>
  </div>
</template>
