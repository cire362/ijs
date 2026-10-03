<script setup lang="ts">
import { BRAND_NAME } from '@/config/brand'

withDefaults(defineProps<{ to?: string, compact?: boolean }>(), { to: '/', compact: false })
</script>

<template>
  <router-link :to="to" class="inline-flex items-center gap-2.5 rounded-control" :aria-label="BRAND_NAME">
    <img src="/brand/logo-mark.svg" alt="" width="34" height="34" class="size-[34px] shrink-0 rounded-[9px] bg-surface p-0.5 ring-1 ring-line">
    <span v-if="!compact" class="text-[17px] font-semibold tracking-tight text-ink">{{ BRAND_NAME }}</span>
  </router-link>
</template>
