<script setup lang="ts">
import type { Component } from 'vue'
import { IconInbox } from '@tabler/icons-vue'

withDefaults(defineProps<{ title: string, text?: string, icon?: Component }>(), { icon: () => IconInbox })
</script>

<template>
  <div class="flex flex-col items-center justify-center px-6 py-14 text-center">
    <div class="mb-4 grid size-12 place-items-center rounded-surface bg-accent-soft text-accent">
      <component :is="icon" :size="24" />
    </div>
    <h3 class="text-base font-semibold text-ink">{{ title }}</h3>
    <p v-if="text" class="mt-1 max-w-[46ch] text-sm text-muted">{{ text }}</p>
    <div v-if="$slots.default" class="mt-5"><slot /></div>
  </div>
</template>
