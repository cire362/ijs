<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import ru from 'element-plus/es/locale/lang/ru'
import { useAuthStore } from '@/stores/auth'
import PublicLayout from '@/layouts/PublicLayout.vue'
import AppLayout from '@/layouts/AppLayout.vue'
import AuthLayout from '@/layouts/AuthLayout.vue'
import CookieBanner from '@/components/CookieBanner.vue'
import SupportWidget from '@/components/support/SupportWidget.vue'

const route = useRoute()
const auth = useAuthStore()

const layout = computed(() => {
  const kind = route.meta.layout ?? 'auto'
  if (kind === 'auto') return auth.user ? AppLayout : PublicLayout
  return { public: PublicLayout, app: AppLayout, auth: AuthLayout }[kind]
})
</script>

<template>
  <el-config-provider :locale="ru">
    <component :is="layout">
      <router-view v-slot="{ Component, route: current }">
        <transition name="route" mode="out-in">
          <component :is="Component" :key="current.path" />
        </transition>
      </router-view>
    </component>
    <CookieBanner />
    <SupportWidget v-if="!auth.isAdmin" />
  </el-config-provider>
</template>
