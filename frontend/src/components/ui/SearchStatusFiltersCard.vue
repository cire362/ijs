<script setup>
defineProps({
  title: { type: String, default: "Фильтры" },
  placeholder: { type: String, default: "Поиск" },
  count: { type: Number, default: 0 },
  statusPlaceholder: { type: String, default: "Все статусы" },

  options: { type: Array, default: () => [] },
  optionValueKey: { type: String, default: "value" },
  optionLabelKey: { type: String, default: "label" },
});

const q = defineModel("q", { type: String, default: "" });
const status = defineModel("status", { type: String, default: "" });
</script>

<template>
  <el-card shadow="never" style="margin-bottom: var(--gap-md)">
    <div class="muted" style="margin-bottom: 8px">{{ title }}</div>
    <div
      style="
        display: flex;
        gap: var(--gap-sm);
        flex-wrap: wrap;
        align-items: center;
      "
    >
      <el-input
        v-model="q"
        clearable
        :placeholder="placeholder"
        style="min-width: 320px"
      />

      <el-select
        v-model="status"
        clearable
        :placeholder="statusPlaceholder"
        style="min-width: 220px"
      >
        <el-option
          v-for="opt in options"
          :key="String(opt?.[optionValueKey] ?? opt?.id ?? opt?.key ?? '')"
          :label="String(opt?.[optionLabelKey] ?? '')"
          :value="String(opt?.[optionValueKey] ?? '')"
        />
      </el-select>

      <div class="muted">Найдено: {{ count }}</div>
    </div>
  </el-card>
</template>
