<script setup lang="ts">
import { computed } from 'vue'
import type { PersonRef } from '@/api/types'
import { initials } from '@/utils/format'

const props = withDefaults(defineProps<{ person?: Partial<PersonRef> | null, src?: string | null, size?: number }>(), { person: null, src: null, size: 36 })
const letters = computed(() => initials(props.person))
</script>

<template>
  <span class="inline-grid shrink-0 place-items-center overflow-hidden rounded-full bg-accent-soft font-semibold text-accent" :style="{ width: `${size}px`, height: `${size}px`, fontSize: `${Math.round(size * 0.38)}px` }">
    <img v-if="src" :src="src" alt="" class="size-full object-cover">
    <span v-else aria-hidden="true">{{ letters }}</span>
  </span>
</template>
