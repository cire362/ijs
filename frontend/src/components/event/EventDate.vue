<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ startAt: string }>()
const date = computed(() => new Date(props.startAt))
const options = { timeZone: 'Europe/Moscow' } as const
</script>

<template>
  <span class="grid w-16 shrink-0 place-items-center rounded-control bg-surface-2 py-2.5 text-center">
    <span class="text-2xl font-semibold leading-none text-ink tabular">{{ date.toLocaleDateString('ru-RU', { ...options, day: 'numeric' }) }}</span>
    <span class="mt-1 text-xs text-muted">{{ date.toLocaleDateString('ru-RU', { ...options, month: 'short' }).replace('.', '') }}</span>
    <span class="text-xs text-subtle tabular">{{ date.toLocaleTimeString('ru-RU', { ...options, hour: '2-digit', minute: '2-digit' }) }}</span>
  </span>
</template>
