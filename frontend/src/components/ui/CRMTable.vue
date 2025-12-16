<template>
  <el-card class="card" shadow="hover">
    <div class="card-head" v-if="title || description">
      <div>
        <div class="eyebrow" v-if="description">{{ description }}</div>
        <div class="title" v-if="title">{{ title }}</div>
      </div>
      <slot name="cta" />
    </div>
    <el-table
      :data="rows"
      :border="border"
      :stripe="stripe"
      :height="height"
      v-loading="loading"
    >
      <el-table-column
        v-for="col in columns"
        :key="col.prop"
        :prop="col.prop"
        :label="col.label"
        :width="col.width"
        :min-width="col.minWidth"
      >
        <template #default="scope">
          <slot :name="col.prop" v-bind="scope">{{ scope.row[col.prop] }}</slot>
        </template>
      </el-table-column>
      <el-table-column
        v-if="$slots.actions"
        label="Действия"
        :width="actionsWidth"
      >
        <template #default="scope">
          <slot name="actions" v-bind="scope" />
        </template>
      </el-table-column>
    </el-table>
  </el-card>
</template>

<script setup>
const props = defineProps({
  columns: { type: Array, required: true },
  rows: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  border: { type: Boolean, default: false },
  stripe: { type: Boolean, default: true },
  height: { type: [String, Number], default: null },
  title: { type: String, default: "" },
  description: { type: String, default: "" },
  actionsWidth: { type: [String, Number], default: 160 },
});
</script>

<style scoped>
.card {
  border-radius: var(--radius);
  box-shadow: var(--card-shadow);
}
.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--gap-sm);
}
.eyebrow {
  color: var(--text-muted);
  font-size: 12px;
  letter-spacing: 0.3px;
  text-transform: uppercase;
}
.title {
  font-size: 18px;
  font-weight: 700;
  letter-spacing: -0.2px;
}
</style>
