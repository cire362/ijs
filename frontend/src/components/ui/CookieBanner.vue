<template>
  <transition name="fade">
    <div v-if="visible" class="banner card-shadow">
      <div>
        <div class="title">Мы используем файлы cookie</div>
        <div class="muted">
          Мы используем обязательные cookie для работы сайта, а также
          аналитические и маркетинговые — только при вашем согласии. Подробнее в
          <a href="/legal?tab=privacy" class="text-blue-500 hover:underline"
            >политикой конфиденциальности</a
          >.
        </div>
      </div>
      <div class="actions">
        <el-button size="small" @click="acceptEssential"
          >Только необходимые</el-button
        >
        <el-button size="small" type="primary" @click="acceptAll"
          >Принять все</el-button
        >
      </div>
    </div>
  </transition>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from "vue";
import {
  hasCookieConsentDecision,
  OPEN_COOKIE_SETTINGS_EVENT,
  saveCookieConsent,
} from "@/utils/consent";

const visible = ref(false);

function openSettings() {
  visible.value = true;
}

onMounted(() => {
  if (!hasCookieConsentDecision()) {
    visible.value = true;
  }

  window.addEventListener(OPEN_COOKIE_SETTINGS_EVENT, openSettings);
});

onBeforeUnmount(() => {
  window.removeEventListener(OPEN_COOKIE_SETTINGS_EVENT, openSettings);
});

function acceptEssential() {
  saveCookieConsent({ analytics: false, marketing: false });
  visible.value = false;
}

function acceptAll() {
  saveCookieConsent({ analytics: true, marketing: true });
  visible.value = false;
}
</script>

<style scoped>
.banner {
  position: fixed;
  bottom: 24px;
  right: 24px;
  background: #fff;
  padding: var(--gap-md);
  border-radius: var(--radius);
  border: 1px solid #e5e5e5;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--gap-md);
  max-width: 520px;
}
.title {
  font-weight: 700;
  margin-bottom: 4px;
}
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--gap-xs);
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

@media (max-width: 640px) {
  .banner {
    left: 16px;
    right: 16px;
    bottom: 16px;
    max-width: none;
    flex-direction: column;
    align-items: stretch;
  }

  .actions {
    justify-content: flex-end;
  }
}
</style>
