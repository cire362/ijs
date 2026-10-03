<script setup lang="ts">
withDefaults(defineProps<{ rows?: number, height?: string }>(), { rows: 4, height: '64px' })
</script>

<template>
  <div class="flex flex-col gap-3" aria-busy="true" aria-label="Загрузка">
    <div v-for="i in rows" :key="i" class="skeleton rounded-surface" :style="{ height }" />
  </div>
</template>
