<script setup lang="ts">
import { addressApi } from '@/api/endpoints'

const props = defineProps<{ kind: 'region' | 'city' | 'street', region?: string, city?: string, placeholder?: string }>()
const model = defineModel<string>({ default: '' })

// Suggestions come from the backend cache of OpenStreetMap results; failures just show no hints.
async function fetch (query: string, done: (items: { value: string }[]) => void) {
  if (query.trim().length < 2) return done([])
  try {
    const items = await addressApi.suggest(props.kind, query, { region: props.region, city: props.city })
    done(items.map((item) => ({ value: item.label })))
  } catch {
    done([])
  }
}
</script>

<template>
  <el-autocomplete v-model="model" :fetch-suggestions="fetch" :debounce="300" :trigger-on-focus="false" :placeholder="placeholder" maxlength="200" class="w-full" clearable />
</template>
