<template>
  <div class="app-shell">
    <AppHeader />
    <main class="page-shell">
      <RouterView />
    </main>
    <CookieBanner />
  </div>
</template>

<script setup>
import AppHeader from "@/components/ui/AppHeader.vue";
import CookieBanner from "@/components/ui/CookieBanner.vue";
</script>
