<template>
  <el-card class="card lift-hover" shadow="hover">
    <div class="preview" v-if="previewUrl">
      <el-image :src="previewUrl" fit="cover" class="preview-img" />
    </div>
    <div class="preview placeholder" v-else>
      <div class="placeholder-text muted">Нет фото</div>
    </div>

    <div class="card-top">
      <div>
        <div class="eyebrow">{{ property.region || "Регион не указан" }}</div>
        <div class="title">{{ property.title }}</div>
        <div class="location">
          {{ property.city }} · {{ property.street || "—" }}
        </div>
      </div>
      <el-tag :type="statusType" size="small">{{
        saleStatusLabel(property.saleStatus)
      }}</el-tag>
    </div>

    <div class="price-row">
      <div class="price" v-if="property.price">{{ priceLabel }}</div>
      <div class="muted" v-else>Цена по запросу</div>
      <div class="chips">
        <el-tag v-if="property.landArea" type="info" effect="plain"
          >Участок {{ property.landArea }} сот.</el-tag
        >
        <el-tag v-if="property.houseArea" type="success" effect="plain"
          >Дом {{ property.houseArea }} м²</el-tag
        >
        <slot name="tags" />
      </div>
    </div>

    <el-divider />

    <div class="meta">
      <div>
        <div class="muted">ID</div>
        <div class="strong">#{{ property.id }}</div>
      </div>
      <div>
        <div class="muted">Улица</div>
        <div class="strong">
          {{ property.street || "—" }} {{ property.plotNumber || "" }}
        </div>
      </div>
      <div>
        <div class="muted">Статус сделки</div>
        <div class="strong">{{ saleStatusLabel(property.saleStatus) }}</div>
      </div>
    </div>

    <div class="actions">
      <slot name="actions" />
    </div>
  </el-card>
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({
  property: { type: Object, required: true },
});

defineEmits(["details"]);

const priceLabel = computed(() =>
  props.property.price ? `${props.property.price.toLocaleString()} ₽` : ""
);

const statusType = computed(() => {
  if (props.property.saleStatus === "available") return "success";
  if (props.property.saleStatus === "reserved") return "warning";
  if (props.property.saleStatus === "sold") return "danger";
  return "info";
});

const previewUrl = computed(() => {
  const first = props.property?.images?.[0];
  return first?.url || "";
});

function saleStatusLabel(status) {
  if (status === "available" || !status) return "Свободен";
  if (status === "reserved") return "Бронь";
  if (status === "sold") return "Продан";
  return "—";
}
</script>

<style scoped>
.card {
  border-radius: var(--radius);
  box-shadow: var(--card-shadow);
}
.preview {
  width: 100%;
  height: 180px;
  border-radius: 10px;
  overflow: hidden;
  margin-bottom: 12px;
  background: var(--muted-bg);
}
.preview-img {
  width: 100%;
  height: 180px;
}
.placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
}
.placeholder-text {
  font-size: 13px;
}
.card-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--gap-sm);
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
.location {
  color: var(--text-muted);
  font-size: 14px;
  margin-top: 4px;
}
.price-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--gap-sm);
  margin: 12px 0;
  flex-wrap: wrap;
}
.price {
  font-size: 20px;
  font-weight: 800;
  color: var(--accent-yellow-dark);
}
.chips {
  display: flex;
  gap: var(--gap-xs);
  align-items: center;
}
.meta {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: var(--gap-sm);
}
.muted {
  color: var(--text-muted);
  font-size: 13px;
}
.strong {
  font-weight: 600;
}
.actions {
  margin-top: 12px;
  display: flex;
  gap: var(--gap-sm);
  align-items: center;
  flex-wrap: wrap;
}
</style>
