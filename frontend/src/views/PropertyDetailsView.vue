<script setup>
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import { apiClient, useAuthStore } from "@/stores/auth";

const auth = useAuthStore();
const route = useRoute();
const router = useRouter();

const loading = ref(false);
const property = ref(null);

const isAgent = computed(() => auth.user?.role === "agent");
const isManager = computed(
  () => auth.user?.role === "developer" || auth.user?.role === "admin"
);

const statusOptions = [
  { value: "available", label: "Свободен" },
  { value: "reserved", label: "Бронь" },
  { value: "sold", label: "Продан" },
];

const applicationComment = ref("");

const id = computed(() => route.params.id);

const statusType = computed(() => {
  const s = property.value?.saleStatus;
  if (s === "available") return "success";
  if (s === "reserved") return "warning";
  if (s === "sold") return "danger";
  return "info";
});

function saleStatusLabel(status) {
  if (status === "available" || !status) return "Свободен";
  if (status === "reserved") return "Бронь";
  if (status === "sold") return "Продан";
  return "—";
}

const priceLabel = computed(() => {
  const p = property.value;
  if (!p?.price) return "По запросу";
  return `${Number(p.price).toLocaleString()} ₽`;
});

const specs = computed(() => {
  const p = property.value;
  if (!p) return [];
  return [
    { label: "Цена", value: priceLabel.value },
    { label: "Статус", value: saleStatusLabel(p.saleStatus) },
    { label: "Регион/Город", value: `${p.region || "—"}, ${p.city || "—"}` },
    { label: "Участок", value: p.landArea ? `${p.landArea} сот.` : "—" },
    { label: "Дом", value: p.houseArea ? `${p.houseArea} м²` : "—" },
    { label: "Этажность", value: p.floors ?? "—" },
    { label: "Комнат", value: p.rooms ?? "—" },
    { label: "Стадия строительства", value: p.buildStage || "—" },
    { label: "Конструкция", value: p.constructionType || "—" },
    { label: "Отделка", value: p.finishingType || "—" },
    { label: "Тип договора", value: p.contractType || "—" },
    { label: "Готовность", value: p.readinessType || "—" },
    { label: "Регистрация", value: "Не указано сервером" },
  ];
});

function imageSrc(url) {
  if (!url) return "";
  return url;
}

async function load() {
  loading.value = true;
  property.value = null;
  try {
    const { data } = await apiClient.get(`/properties/${id.value}`);
    property.value = data;
  } catch (err) {
    const msg = err.response?.data?.error || "Не удалось загрузить объект";
    ElMessage.error(msg);
  } finally {
    loading.value = false;
  }
}

watch(id, () => load(), { immediate: true });

function goBack() {
  if (window.history.length > 1) router.back();
  else router.push("/properties");
}

async function applyToProperty() {
  if (!property.value?.id) return;
  try {
    await apiClient.post("/applications", {
      propertyId: property.value.id,
      comment: applicationComment.value || "",
    });
    ElMessage.success("Заявка отправлена");
    applicationComment.value = "";
  } catch (err) {
    ElMessage.error(err.response?.data?.error || "Не удалось отправить заявку");
  }
}

async function updatePropertyStatus(status) {
  if (!property.value?.id) return;
  const prev = property.value.saleStatus;
  property.value.saleStatus = status;
  try {
    await apiClient.patch(`/properties/${property.value.id}`, {
      saleStatus: status,
    });
    ElMessage.success("Статус обновлен");
  } catch (err) {
    property.value.saleStatus = prev;
    ElMessage.error(err.response?.data?.error || "Не удалось обновить статус");
  }
}
</script>

<template>
  <div>
    <div class="section-head">
      <div>
        <div class="pill">Карточка объекта</div>
        <h1 style="margin: 4px 0">{{ property?.title || "Объект" }}</h1>
        <div v-if="property" class="muted">
          {{ property.city }}, {{ property.street || "—" }}
          {{ property.plotNumber || "" }}
        </div>
      </div>

      <div class="head-actions">
        <el-button type="default" @click="goBack">Назад</el-button>
        <el-tag v-if="property" :type="statusType">{{
          saleStatusLabel(property.saleStatus)
        }}</el-tag>
      </div>
    </div>

    <div class="detail-layout">
      <div class="left">
        <el-card shadow="never" v-loading="loading">
          <div class="price-row">
            <div class="price">{{ priceLabel }}</div>
            <div class="muted" v-if="property?.developer">
              {{
                property.developer?.companyName ||
                property.developer?.fullName ||
                "Застройщик не указан"
              }}
            </div>
          </div>

          <div class="gallery" v-if="property?.images?.length">
            <el-carousel height="320px" trigger="click">
              <el-carousel-item v-for="img in property.images" :key="img.id">
                <el-image
                  :src="imageSrc(img.url)"
                  fit="cover"
                  style="width: 100%; height: 320px"
                  :alt="img.caption || property.title"
                />
              </el-carousel-item>
            </el-carousel>
          </div>
          <el-empty v-else-if="!loading" description="Фото не прикреплены" />

          <el-divider />

          <div class="muted">Описание</div>
          <div style="margin-top: 6px">
            {{ property?.description || "Описание не указано" }}
          </div>
        </el-card>
      </div>

      <div class="right">
        <el-card shadow="never" v-loading="loading">
          <div class="specs">
            <div v-for="s in specs" :key="s.label" class="spec">
              <div class="muted">{{ s.label }}</div>
              <div class="strong">{{ s.value }}</div>
            </div>
          </div>
        </el-card>

        <el-card
          v-if="isAgent"
          shadow="never"
          style="margin-top: var(--gap-md)"
          v-loading="loading"
        >
          <div class="muted" style="margin-bottom: 8px">Заявка</div>
          <el-input
            v-model="applicationComment"
            :rows="3"
            type="textarea"
            placeholder="Комментарий к заявке"
          />
          <div
            style="display: flex; justify-content: flex-end; margin-top: 12px"
          >
            <el-button
              type="primary"
              :disabled="!property"
              @click="applyToProperty"
              >Подать заявку</el-button
            >
          </div>
        </el-card>

        <el-card
          v-else-if="isManager"
          shadow="never"
          style="margin-top: var(--gap-md)"
          v-loading="loading"
        >
          <div class="muted" style="margin-bottom: 8px">Статус объекта</div>
          <el-select
            v-model="property.saleStatus"
            placeholder="Статус"
            style="width: 100%"
            :disabled="!property"
            @change="(val) => updatePropertyStatus(val)"
          >
            <el-option
              v-for="opt in statusOptions"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>
        </el-card>
      </div>
    </div>
  </div>
</template>

<style scoped>
.head-actions {
  display: flex;
  align-items: center;
  gap: var(--gap-sm);
}

.detail-layout {
  display: grid;
  grid-template-columns: 1.55fr 0.9fr;
  gap: var(--gap-md);
}

.price-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--gap-sm);
  flex-wrap: wrap;
  margin-bottom: 12px;
}

.price {
  font-size: 22px;
  font-weight: 800;
  color: var(--accent-yellow-dark);
}

.specs {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--gap-sm);
}

.spec {
  padding: 10px 12px;
  border-radius: 10px;
  background: var(--muted-bg);
}

.strong {
  font-weight: 700;
}

@media (max-width: 960px) {
  .detail-layout {
    grid-template-columns: 1fr;
  }
}
</style>
