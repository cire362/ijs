<script setup lang="ts">
import type { Tone } from '@/utils/status'

withDefaults(defineProps<{ tone?: Tone, label: string }>(), { tone: 'neutral' })

const tones: Record<Tone, string> = {
  neutral: 'bg-surface-2 text-muted',
  accent: 'bg-accent-soft text-accent',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger'
}
</script>

<template>
  <span class="inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-[13px] font-medium" :class="tones[tone]">{{ label }}</span>
</template>
