<script setup lang="ts">
import { computed } from 'vue'
import { IconBed, IconMapPin, IconRuler2, IconStairs, IconPhoto } from '@tabler/icons-vue'
import type { Property } from '@/api/types'
import { formatArea, formatPrice } from '@/utils/format'
import { propertyImageUrl } from '@/utils/propertyImages'
import { SALE_STATUS } from '@/utils/status'
import StatusTag from '@/components/StatusTag.vue'

const props = withDefaults(defineProps<{ property: Property, to?: string | null, showStatus?: boolean }>(), { to: undefined, showStatus: true })
const cover = computed(() => propertyImageUrl(props.property.images?.[0]?.url))
const address = computed(() => [props.property.city, props.property.street].filter(Boolean).join(', '))
const link = computed(() => props.to === null ? null : props.to ?? `/properties/${props.property.id}`)
</script>

<template>
  <component :is="link ? 'router-link' : 'div'" :to="link ?? undefined" class="group surface press flex h-full flex-col overflow-hidden transition-shadow hover:shadow-soft">
    <div class="relative aspect-[4/3] overflow-hidden bg-surface-2">
      <img v-if="cover" :src="cover" :alt="property.title" loading="lazy" class="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]">
      <div v-else class="grid size-full place-items-center text-subtle"><IconPhoto :size="32" /></div>
    </div>
    <div class="flex flex-1 flex-col gap-2 p-4">
      <div class="flex items-start justify-between gap-3">
        <h3 class="line-clamp-2 text-[16px] font-semibold leading-snug text-ink">{{ property.title }}</h3>
        <StatusTag v-if="showStatus && property.saleStatus !== 'available'" :tone="SALE_STATUS[property.saleStatus].tone" :label="SALE_STATUS[property.saleStatus].label" />
      </div>
      <p class="flex items-center gap-1.5 text-sm text-muted"><IconMapPin :size="16" /><span class="truncate">{{ address || property.region }}</span></p>
      <ul class="mt-auto flex flex-wrap gap-x-4 gap-y-1 pt-2 text-sm text-muted">
        <li v-if="property.houseArea" class="flex items-center gap-1"><IconRuler2 :size="16" />{{ formatArea(property.houseArea) }}</li>
        <li v-if="property.rooms" class="flex items-center gap-1"><IconBed :size="16" />{{ property.rooms }} комн.</li>
        <li v-if="property.floors" class="flex items-center gap-1"><IconStairs :size="16" />{{ property.floors }} эт.</li>
      </ul>
      <p class="pt-1 text-lg font-semibold text-ink tabular">{{ formatPrice(property.price) }}</p>
    </div>
  </component>
</template>
