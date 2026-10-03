<script setup lang="ts">
import { addressApi, type AddressKind } from '@/api/endpoints'
import type { AddressSuggestion } from '@/api/types'

const props = withDefaults(defineProps<{ kind?: AddressKind, region?: string, city?: string, placeholder?: string }>(), { kind: 'address' })
const model = defineModel<string>({ default: '' })
const emit = defineEmits<{ select: [suggestion: AddressSuggestion] }>()

type Option = AddressSuggestion & { value: string, full: string }

// Suggestions come from the server (DaData, or known addresses of objects); failures just show no hints.
async function fetch (query: string, done: (items: Option[]) => void) {
  if (query.trim().length < 2) return done([])
  try {
    const items = await addressApi.suggest(props.kind, query, { region: props.region || undefined, city: props.city || undefined })
    done(items.map((item) => ({ ...item, full: item.value, value: item.label })))
  } catch {
    done([])
  }
}

function choose (item: Record<string, unknown>) {
  const option = item as unknown as Option
  emit('select', { ...option, value: option.full })
}
</script>

<template>
  <el-autocomplete v-model="model" :fetch-suggestions="fetch" :debounce="250" :trigger-on-focus="false" :placeholder="placeholder" maxlength="255" class="w-full" clearable highlight-first-item @select="choose">
    <template #default="{ item }">
      <div class="py-1 leading-snug">
        <div class="truncate text-ink">{{ item.label }}</div>
        <div v-if="kind !== 'address' && item.full !== item.label" class="truncate text-xs text-subtle">{{ item.full }}</div>
      </div>
    </template>
  </el-autocomplete>
</template>
