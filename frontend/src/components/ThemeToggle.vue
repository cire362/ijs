<script setup lang="ts">
import { computed } from 'vue'
import { IconDeviceDesktop, IconMoon, IconSun } from '@tabler/icons-vue'
import { useThemeStore } from '@/stores/theme'

const theme = useThemeStore()
const label = computed(() => ({ system: 'Тема: как в системе', light: 'Тема: светлая', dark: 'Тема: тёмная' })[theme.mode])
const icon = computed(() => ({ system: IconDeviceDesktop, light: IconSun, dark: IconMoon })[theme.mode])
</script>

<template>
  <el-tooltip :content="label" placement="bottom">
    <button type="button" class="press grid size-9 place-items-center rounded-control text-muted transition-colors hover:bg-surface-2 hover:text-ink" :aria-label="label" @click="theme.cycle()">
      <component :is="icon" :size="19" />
    </button>
  </el-tooltip>
</template>
