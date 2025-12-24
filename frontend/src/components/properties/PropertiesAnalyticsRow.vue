<script setup>
import AnalyticsWidget from "@/components/ui/AnalyticsWidget.vue";

defineProps({
  analytics: { type: Object, required: true },
  scopeHint: { type: String, default: "" },
});
</script>

<template>
  <el-row :gutter="16" style="margin-bottom: var(--gap-md)">
    <el-col :span="8" :xs="24" :sm="12" :md="8">
      <AnalyticsWidget
        label="Объектов в базе"
        :value="String(analytics.total)"
        :delta="`+${analytics.createdLast7} за 7 дней`"
        :hint="scopeHint"
      />
    </el-col>
    <el-col :span="8" :xs="24" :sm="12" :md="8">
      <AnalyticsWidget
        label="Свободны"
        :value="String(analytics.available)"
        :delta="`${analytics.availablePct}% от базы`"
        hint="Можно бронировать"
      />
    </el-col>
    <el-col :span="8" :xs="24" :sm="12" :md="8">
      <AnalyticsWidget
        label="В работе (бронь)"
        :value="String(analytics.reserved)"
        :delta="`${analytics.sold} продано`"
        trend="up"
        hint="Объекты со статусом «Бронь»"
      />
    </el-col>
  </el-row>
</template>
