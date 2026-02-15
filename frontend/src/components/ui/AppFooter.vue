<template>
  <footer class="bg-[#1A1A1A] text-white pt-10 pb-10 mt-auto">
    <div class="container mx-auto px-4 md:px-8">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-8 text-sm text-gray-400">
        <div>
          <div class="flex items-center gap-2 mb-6">
            <div
              class="w-6 h-6 bg-accent rounded flex items-center justify-center"
            >
              <span class="font-bold text-white text-xs">I</span>
            </div>
            <span class="font-bold text-white tracking-tight">IJSHub</span>
          </div>
          <p>© 2024 IJSHub.</p>
          <p>Все права защищены.</p>
        </div>
        <div>
          <h4 class="font-bold text-white mb-4">Разделы</h4>
          <ul class="space-y-2">
            <li>
              <router-link to="/news" class="hover:text-accent"
                >Новости</router-link
              >
            </li>
            <li>
              <router-link to="/events" class="hover:text-accent"
                >Мероприятия</router-link
              >
            </li>
          </ul>
        </div>
        <div>
          <h4 class="font-bold text-white mb-4">Поддержка</h4>
          <ul class="space-y-2">
            <li>
              <a href="mailto:support@ijshub.com" class="hover:text-accent"
                >support@ijshub.com</a
              >
            </li>
          </ul>
        </div>
      </div>

      <div
        class="border-t border-gray-800 mt-12 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-gray-500"
      >
        <div>IJSHub © 2026 ООО «АйДжейЭс». Все права защищены.</div>
        <div class="flex flex-wrap gap-4 md:gap-8 justify-center">
          <router-link to="/legal" class="hover:text-white transition"
            >Правовые документы</router-link
          >
          <router-link
            :to="{ path: '/legal', query: { tab: 'privacy' } }"
            class="hover:text-white transition"
            >Политика конфиденциальности</router-link
          >
          <button class="hover:text-white transition" @click="openCookies">
            Настройки cookie
          </button>
        </div>
        <div>ИНН 1234567890</div>
      </div>
    </div>
  </footer>
</template>

<script setup>
import { openCookieSettings } from "@/utils/consent";

function openCookies() {
  openCookieSettings();
}
</script>

<style scoped>
.bg-accent {
  background-color: #ffcc00;
}
.text-accent {
  color: #fdd835;
}
</style>
