<script setup lang="ts">
import { BRAND_NAME } from '@/config/brand'

withDefaults(defineProps<{ to?: string, compact?: boolean }>(), { to: '/', compact: false })
</script>

<template>
  <router-link :to="to" class="inline-flex items-center gap-2.5 rounded-control" :aria-label="BRAND_NAME">
    <img src="/brand/logo-mark.svg?v=2" alt="" width="36" height="36" class="size-9 shrink-0">
    <span v-if="!compact" class="text-[17px] font-semibold tracking-tight text-ink">{{ BRAND_NAME }}</span>
  </router-link>
</template>
