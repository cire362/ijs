<script setup lang="ts">
import { computed } from 'vue'
import { IconClockHour4 } from '@tabler/icons-vue'
import { formatDateTime, pluralize } from '@/utils/format'

const props = defineProps<{ expiresAt: string | null, compact?: boolean }>()

const left = computed(() => props.expiresAt ? new Date(props.expiresAt).getTime() - Date.now() : null)
const text = computed(() => {
  if (left.value == null) return 'Без срока'
  if (left.value <= 0) return 'Срок истёк'
  const hours = Math.floor(left.value / 3600000)
  if (hours < 24) return `${hours} ${pluralize(hours, 'час', 'часа', 'часов')}`
  const days = Math.floor(hours / 24)
  return `${days} ${pluralize(days, 'день', 'дня', 'дней')}`
})
const urgent = computed(() => left.value != null && left.value < 2 * 86400000)
</script>

<template>
  <span v-if="compact" class="tabular" :class="urgent ? 'font-medium text-warning' : 'text-muted'">{{ text }}</span>
  <div v-else class="flex items-center gap-3 rounded-control px-4 py-3" :class="urgent ? 'bg-warning-soft' : 'bg-accent-soft'">
    <IconClockHour4 :size="20" :class="urgent ? 'text-warning' : 'text-accent'" />
    <p class="text-sm text-ink">
      <template v-if="left != null && left > 0">Заявка действует ещё <span class="font-semibold">{{ text }}</span>, до {{ formatDateTime(expiresAt) }}</template>
      <template v-else>{{ text }}</template>
    </p>
  </div>
</template>
