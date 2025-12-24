<script setup>
defineProps({
  events: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  emptyText: { type: String, default: "Мероприятий пока нет" },

  formatDateTime: { type: Function, required: true },
  formatLabel: { type: Function, required: true },
  formatTagType: { type: Function, required: true },
});
</script>

<template>
  <div v-loading="loading" style="display: grid; gap: var(--gap-md)">
    <el-empty v-if="!events.length" :description="emptyText" />

    <el-card v-for="e in events" :key="e.id" shadow="hover">
      <img
        v-if="e.coverImageUrl"
        :src="e.coverImageUrl"
        alt=""
        style="
          width: 100%;
          height: 200px;
          object-fit: cover;
          border-radius: 12px;
          margin-bottom: 10px;
        "
      />

      <div
        style="
          display: flex;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
        "
      >
        <div>
          <div style="font-weight: 800; font-size: 18px">
            {{ e.title }}
            <el-tag
              v-if="e.isTraining"
              type="success"
              effect="light"
              style="margin-left: 8px"
              >Обучение</el-tag
            >
            <el-tag
              v-if="e.format"
              :type="formatTagType(e.format)"
              effect="light"
              style="margin-left: 8px"
            >
              {{ formatLabel(e.format) }}
            </el-tag>
          </div>

          <div class="muted" style="margin-top: 6px">
            {{ formatDateTime(e.startAt)
            }}<span v-if="e.endAt"> — {{ formatDateTime(e.endAt) }}</span>
          </div>

          <div v-if="e.location" class="muted" style="margin-top: 6px">
            {{ e.location }}
          </div>

          <div
            v-if="e.description"
            style="margin-top: 10px; white-space: pre-wrap"
          >
            {{ e.description }}
          </div>
        </div>

        <div
          style="
            display: flex;
            align-items: flex-start;
            gap: 8px;
            flex-wrap: wrap;
          "
        >
          <slot name="actions" :event="e" />
        </div>
      </div>
    </el-card>
  </div>
</template>
