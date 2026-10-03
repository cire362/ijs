<script setup lang="ts">
import { IconAlertTriangle } from '@tabler/icons-vue'

defineProps<{ message: string }>()
defineEmits<{ retry: [] }>()
</script>

<template>
  <div class="flex flex-col items-center px-6 py-12 text-center" role="alert">
    <div class="mb-3 grid size-11 place-items-center rounded-surface bg-danger-soft text-danger">
      <IconAlertTriangle :size="22" />
    </div>
    <p class="max-w-[50ch] text-ink">{{ message }}</p>
    <el-button class="mt-4" @click="$emit('retry')">Повторить</el-button>
  </div>
</template>
