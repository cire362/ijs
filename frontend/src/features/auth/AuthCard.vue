<script setup lang="ts">
defineProps<{ title: string, subtitle?: string }>()
</script>

<template>
  <section class="surface p-6 shadow-soft md:p-8">
    <h1 class="text-2xl font-semibold text-ink">{{ title }}</h1>
    <p v-if="subtitle" class="mt-1.5 text-muted">{{ subtitle }}</p>
    <div class="mt-6"><slot /></div>
    <div v-if="$slots.footer" class="mt-6 border-t border-line pt-5 text-sm text-muted"><slot name="footer" /></div>
  </section>
</template>
