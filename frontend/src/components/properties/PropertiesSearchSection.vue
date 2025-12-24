<script setup>
import FiltersBar from "@/components/ui/FiltersBar.vue";
import CardsList from "@/components/ui/CardsList.vue";
import SearchResultsCard from "@/components/ui/SearchResultsCard.vue";

const props = defineProps({
  regions: { type: Array, default: () => [] },
  cities: { type: Array, default: () => [] },
  stages: { type: Array, default: () => [] },
  finishingTypes: { type: Array, default: () => [] },
  contractTypes: { type: Array, default: () => [] },
  constructionTypes: { type: Array, default: () => [] },
  readinessTypes: { type: Array, default: () => [] },
  developerOptions: { type: Array, default: () => [] },

  loading: { type: Boolean, default: false },

  totalAll: { type: Number, default: 0 },
  totalFound: { type: Number, default: 0 },

  pagedItems: { type: Array, default: () => [] },

  page: { type: Number, default: 1 },
  pageSize: { type: Number, default: 12 },
});

const emit = defineEmits([
  "filtersApply",
  "filtersReset",
  "update:page",
  "update:pageSize",
]);
</script>

<template>
  <FiltersBar
    :regions="regions"
    :cities="cities"
    :stages="stages"
    :finishingTypes="finishingTypes"
    :contractTypes="contractTypes"
    :constructionTypes="constructionTypes"
    :readinessTypes="readinessTypes"
    :developerOptions="developerOptions"
    @apply="(payload) => emit('filtersApply', payload)"
    @reset="() => emit('filtersReset')"
    style="margin-bottom: var(--gap-md)"
  />

  <div class="muted" style="margin-bottom: 8px">
    Всего: {{ totalAll }} · Найдено:
    {{ totalFound }}
  </div>

  <slot name="resultsTop" />

  <div style="margin-bottom: var(--gap-md)" v-loading="loading">
    <CardsList>
      <SearchResultsCard v-for="p in pagedItems" :key="p.id" :property="p">
        <template #actions>
          <slot name="actions" :property="p" />
        </template>
      </SearchResultsCard>
    </CardsList>
  </div>

  <div
    v-if="totalFound > pageSize"
    style="display: flex; justify-content: center; margin-top: var(--gap-md)"
  >
    <el-pagination
      :current-page="page"
      :page-size="pageSize"
      :total="totalFound"
      :page-sizes="[5, 12, 24, 48]"
      layout="total, sizes, prev, pager, next"
      @update:current-page="(v) => emit('update:page', v)"
      @update:page-size="(v) => emit('update:pageSize', v)"
    />
  </div>
</template>
