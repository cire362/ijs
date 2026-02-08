<template>
  <div
    class="app-shell min-h-screen flex flex-col"
    style="min-height: 100vh; display: flex; flex-direction: column"
  >
    <header v-if="!isLanding">
      <AppHeader />
    </header>
    <main :class="['flex-1', { 'page-shell': !isLanding }]" style="flex: 1">
      <RouterView />
    </main>
    <footer>
      <AppFooter />
    </footer>
    <CookieBanner />
    <SupportWidget v-if="!isAdmin" />
  </div>
</template>

<script setup>
import { computed } from "vue";
import { useRoute } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import AppHeader from "@/components/ui/AppHeader.vue";
import AppFooter from "@/components/ui/AppFooter.vue";
import CookieBanner from "@/components/ui/CookieBanner.vue";
import SupportWidget from "@/components/ui/SupportWidget.vue";

const route = useRoute();
const auth = useAuthStore();
const isLanding = computed(() => route.path === "/");
const isAdmin = computed(() => auth.user?.role === "admin");
</script>
