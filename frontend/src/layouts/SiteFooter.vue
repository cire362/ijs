<script setup lang="ts">
import { BRAND_NAME } from '@/config/brand'
import { openCookieSettings } from '@/utils/consent'
import AppLogo from '@/components/AppLogo.vue'

const year = new Date().getFullYear()
</script>

<template>
  <footer class="border-t border-line bg-surface">
    <div class="mx-auto grid max-w-7xl gap-8 px-4 py-10 md:grid-cols-[1.4fr_1fr_1fr] md:px-8">
      <div>
        <AppLogo />
        <p class="mt-3 max-w-[40ch] text-sm text-muted">Дома и участки ИЖС от застройщиков. Заявки, бронирование и сделка в одном кабинете.</p>
      </div>
      <nav aria-label="Разделы" class="flex flex-col gap-2 text-sm">
        <span class="font-semibold text-ink">Разделы</span>
        <router-link to="/properties" class="text-muted hover:text-ink">Каталог объектов</router-link>
        <router-link to="/news" class="text-muted hover:text-ink">Новости</router-link>
        <router-link to="/events" class="text-muted hover:text-ink">Мероприятия</router-link>
      </nav>
      <nav aria-label="Документы" class="flex flex-col gap-2 text-sm">
        <span class="font-semibold text-ink">Документы</span>
        <router-link to="/legal?tab=privacy" class="text-muted hover:text-ink">Политика конфиденциальности</router-link>
        <router-link to="/legal?tab=terms" class="text-muted hover:text-ink">Пользовательское соглашение</router-link>
        <button type="button" class="text-left text-muted hover:text-ink" @click="openCookieSettings">Настройки cookie</button>
      </nav>
    </div>
    <div class="border-t border-line">
      <p class="mx-auto max-w-7xl px-4 py-4 text-xs text-subtle md:px-8">© {{ year }} {{ BRAND_NAME }}</p>
    </div>
  </footer>
</template>
