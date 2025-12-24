<script setup>
defineProps({
  label: { type: String, default: "Поиск" },
  count: { type: Number, default: 0 },
  placeholder: { type: String, default: "Поиск" },
  minWidth: { type: String, default: "320px" },
});

const q = defineModel("q", { type: String, default: "" });
const emit = defineEmits(["input"]);
</script>

<template>
  <el-card shadow="never" style="margin-bottom: var(--gap-md)">
    <div class="muted" style="margin-bottom: 8px">{{ label }}</div>
    <el-input
      v-model="q"
      clearable
      :placeholder="placeholder"
      :style="{ minWidth }"
      @input="() => emit('input')"
    />
    <div class="muted" style="margin-top: 8px">Найдено: {{ count }}</div>
  </el-card>
</template>
