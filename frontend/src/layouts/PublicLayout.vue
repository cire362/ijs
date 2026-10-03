<script setup lang="ts">
import { ref } from 'vue'
import { IconMenu2, IconX } from '@tabler/icons-vue'
import { homeFor } from '@/router'
import { useAuthStore } from '@/stores/auth'
import AppLogo from '@/components/AppLogo.vue'
import ThemeToggle from '@/components/ThemeToggle.vue'
import SiteFooter from './SiteFooter.vue'

const auth = useAuthStore()
const menu = ref(false)
const links = [
  { to: '/properties', label: 'Каталог' },
  { to: '/news', label: 'Новости' },
  { to: '/events', label: 'Мероприятия' }
]
</script>

<template>
  <div class="flex min-h-[100dvh] flex-col">
    <header class="sticky top-0 z-20 border-b border-line bg-[color-mix(in_srgb,var(--bg)_88%,transparent)] backdrop-blur-md">
      <div class="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 md:px-8">
        <AppLogo />
        <nav class="hidden items-center gap-1 md:flex" aria-label="Основная навигация">
          <router-link v-for="link in links" :key="link.to" :to="link.to" class="rounded-control px-3 py-2 text-[15px] text-muted transition-colors hover:text-ink" active-class="!text-ink font-medium">{{ link.label }}</router-link>
        </nav>
        <div class="flex items-center gap-2">
          <ThemeToggle />
          <template v-if="auth.user">
            <router-link :to="homeFor(auth.role, auth.user.developerApproved)" class="hidden sm:block"><el-button type="primary">Кабинет</el-button></router-link>
          </template>
          <template v-else>
            <router-link to="/login" class="hidden sm:block"><el-button text>Войти</el-button></router-link>
            <router-link to="/register" class="hidden sm:block"><el-button type="primary">Регистрация</el-button></router-link>
          </template>
          <button type="button" class="grid size-9 place-items-center rounded-control text-ink md:hidden" :aria-expanded="menu" aria-label="Меню" @click="menu = !menu">
            <component :is="menu ? IconX : IconMenu2" :size="22" />
          </button>
        </div>
      </div>
      <nav v-if="menu" class="border-t border-line px-4 pb-4 pt-2 md:hidden" aria-label="Мобильная навигация" @click="menu = false">
        <router-link v-for="link in links" :key="link.to" :to="link.to" class="block rounded-control px-2 py-3 text-ink">{{ link.label }}</router-link>
        <div class="mt-2 grid grid-cols-2 gap-2">
          <template v-if="auth.user">
            <router-link :to="homeFor(auth.role, auth.user.developerApproved)" class="col-span-2"><el-button type="primary" class="w-full">Кабинет</el-button></router-link>
          </template>
          <template v-else>
            <router-link to="/login"><el-button class="w-full">Войти</el-button></router-link>
            <router-link to="/register"><el-button type="primary" class="w-full">Регистрация</el-button></router-link>
          </template>
        </div>
      </nav>
    </header>
    <main class="flex-1">
      <slot />
    </main>
    <SiteFooter />
  </div>
</template>
