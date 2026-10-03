<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { hasCookieDecision, OPEN_COOKIE_SETTINGS_EVENT, saveCookieConsent } from '@/utils/consent'

const visible = ref(false)
const show = () => { visible.value = true }

onMounted(() => {
  visible.value = !hasCookieDecision()
  window.addEventListener(OPEN_COOKIE_SETTINGS_EVENT, show)
})
onBeforeUnmount(() => window.removeEventListener(OPEN_COOKIE_SETTINGS_EVENT, show))

function decide (all: boolean) {
  saveCookieConsent(all, all)
  visible.value = false
}
</script>

<template>
  <transition enter-from-class="opacity-0 translate-y-3" leave-to-class="opacity-0 translate-y-3" enter-active-class="transition duration-300" leave-active-class="transition duration-200">
    <section v-if="visible" class="fixed inset-x-4 bottom-4 z-40 max-w-[520px] surface p-5 shadow-soft md:inset-x-auto md:left-6 md:bottom-6" aria-label="Файлы cookie">
      <h2 class="text-base font-semibold text-ink">Мы используем файлы cookie</h2>
      <p class="mt-1.5 text-sm text-muted">
        Мы используем обязательные cookie для работы сайта, а также аналитические и маркетинговые — только при вашем согласии. Подробнее в
        <router-link to="/legal?tab=privacy" class="link">политике конфиденциальности</router-link>.
      </p>
      <div class="mt-4 flex flex-wrap justify-end gap-2">
        <el-button @click="decide(false)">Только необходимые</el-button>
        <el-button type="primary" @click="decide(true)">Принять все</el-button>
      </div>
    </section>
  </transition>
</template>
