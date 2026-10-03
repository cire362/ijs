<script setup lang="ts">
import AppLogo from '@/components/AppLogo.vue'
import ThemeToggle from '@/components/ThemeToggle.vue'
</script>

<template>
  <div class="flex min-h-[100dvh] flex-col">
    <header class="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 md:px-8">
      <AppLogo />
      <ThemeToggle />
    </header>
    <main class="flex flex-1 items-start justify-center px-4 pb-16 pt-6 md:pt-12">
      <div class="w-full max-w-[460px]">
        <slot />
      </div>
    </main>
    <footer class="px-4 pb-6 text-center text-xs text-subtle">
      <router-link to="/legal?tab=privacy" class="hover:text-ink">Политика конфиденциальности</router-link>
      <span class="mx-2">|</span>
      <router-link to="/legal?tab=terms" class="hover:text-ink">Пользовательское соглашение</router-link>
    </footer>
  </div>
</template>
