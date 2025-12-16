<template>
  <el-card class="card" shadow="hover">
    <div class="eyebrow">{{ label }}</div>
    <div class="value">{{ value }}</div>
    <div class="trend" :class="trendClass">
      <el-icon v-if="trend === 'up'" color="#2e8b57"><ArrowUp /></el-icon>
      <el-icon v-else-if="trend === 'down'" color="#e53935"
        ><ArrowDown
      /></el-icon>
      <span>{{ delta }}</span>
    </div>
    <div class="hint" v-if="hint">{{ hint }}</div>
  </el-card>
</template>

<script setup>
import { computed } from "vue";
import { ArrowUp, ArrowDown } from "@element-plus/icons-vue";

const props = defineProps({
  label: { type: String, required: true },
  value: { type: String, required: true },
  delta: { type: String, default: "" },
  trend: { type: String, default: "up" },
  hint: { type: String, default: "" },
});

const trendClass = computed(() => (props.trend === "down" ? "down" : "up"));
</script>

<style scoped>
.card {
  border-radius: var(--radius);
  box-shadow: var(--card-shadow);
}
.eyebrow {
  color: var(--text-muted);
  font-size: 12px;
  letter-spacing: 0.3px;
  text-transform: uppercase;
}
.value {
  font-size: 26px;
  font-weight: 800;
  margin: 6px 0;
}
.trend {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
}
.trend.up {
  color: var(--success);
}
.trend.down {
  color: var(--danger);
}
.hint {
  color: var(--text-muted);
  font-size: 13px;
  margin-top: 8px;
}
</style>
