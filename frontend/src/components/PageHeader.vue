<script setup lang="ts">
defineProps<{ title: string, description?: string }>()
</script>

<template>
  <header class="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
    <div class="min-w-0">
      <slot name="back" />
      <h1 class="text-2xl font-semibold text-ink md:text-[28px]">{{ title }}</h1>
      <p v-if="description" class="mt-1.5 max-w-[65ch] text-muted">{{ description }}</p>
    </div>
    <div v-if="$slots.actions" class="flex flex-wrap items-center gap-2">
      <slot name="actions" />
    </div>
  </header>
</template>
