<script setup>
import { onMounted, ref, computed, watch } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore, apiClient } from "../stores/auth";
import { ElMessage } from "element-plus";
import FiltersBar from "@/components/ui/FiltersBar.vue";
import CardsList from "@/components/ui/CardsList.vue";
import SearchResultsCard from "@/components/ui/SearchResultsCard.vue";
import AnalyticsWidget from "@/components/ui/AnalyticsWidget.vue";

const auth = useAuthStore();
const router = useRouter();
const items = ref([]);
const loading = ref(false);

const isAgent = computed(() => auth.user?.role === "agent");
const isManager = computed(
  () => auth.user?.role === "developer" || auth.user?.role === "admin"
);
const isAdmin = computed(() => auth.user?.role === "admin");
const statusOptions = [
  { value: "available", label: "Свободен" },
  { value: "reserved", label: "Бронь" },
  { value: "sold", label: "Продан" },
];

const filters = ref({
  search: "",
  region: "",
  city: "",
  status: "",
  buildStage: "",
  finishingType: "",
  contractType: "",
  constructionType: "",
  readinessType: "",
  priceMin: null,
  priceMax: null,
  landMin: null,
  landMax: null,
  houseMin: null,
  houseMax: null,
});

const form = ref({
  developerId: "",
  title: "",
  region: "",
  city: "",
  street: "",
  plotNumber: "",
  landArea: "",
  houseArea: "",
  price: "",
});

const developerOptions = ref([]);
const developerLoading = ref(false);

function developerLabel(d) {
  if (!d) return "";
  const fullName =
    d.fullName ||
    [d.lastName, d.firstName, d.middleName].filter(Boolean).join(" ");
  return d.companyName || fullName || d.email || `#${d.id}`;
}

async function searchDevelopers(query) {
  developerLoading.value = true;
  try {
    const { data } = await apiClient.get("/users/developers", {
      params: { q: query || "" },
    });
    developerOptions.value = Array.isArray(data) ? data : [];
  } catch (err) {
    developerOptions.value = [];
  } finally {
    developerLoading.value = false;
  }
}

const applicationComments = ref({});

const filteredItems = computed(() => {
  const term = filters.value.search.toLowerCase();
  return items.value.filter((p) => {
    const hay = `${p.title || ""} ${p.city || ""} ${p.region || ""} ${
      p.developer?.companyName || ""
    }`
      .toLowerCase()
      .trim();
    const matchesTerm = !term || hay.includes(term);
    const matchesStatus =
      !filters.value.status || p.saleStatus === filters.value.status;

    const matchesRegion =
      !filters.value.region || p.region === filters.value.region;
    const matchesCity = !filters.value.city || p.city === filters.value.city;
    const matchesStage =
      !filters.value.buildStage || p.buildStage === filters.value.buildStage;

    const matchesFinishing =
      !filters.value.finishingType ||
      p.finishingType === filters.value.finishingType;
    const matchesContract =
      !filters.value.contractType ||
      p.contractType === filters.value.contractType;
    const matchesConstruction =
      !filters.value.constructionType ||
      p.constructionType === filters.value.constructionType;
    const matchesReadiness =
      !filters.value.readinessType ||
      p.readinessType === filters.value.readinessType;

    const price = p.price != null ? Number(p.price) : null;
    const matchesPriceMin =
      filters.value.priceMin == null ||
      (price != null && price >= filters.value.priceMin);
    const matchesPriceMax =
      filters.value.priceMax == null ||
      (price != null && price <= filters.value.priceMax);

    const land = p.landArea != null ? Number(p.landArea) : null;
    const matchesLandMin =
      filters.value.landMin == null ||
      (land != null && land >= filters.value.landMin);
    const matchesLandMax =
      filters.value.landMax == null ||
      (land != null && land <= filters.value.landMax);

    const house = p.houseArea != null ? Number(p.houseArea) : null;
    const matchesHouseMin =
      filters.value.houseMin == null ||
      (house != null && house >= filters.value.houseMin);
    const matchesHouseMax =
      filters.value.houseMax == null ||
      (house != null && house <= filters.value.houseMax);

    return (
      matchesTerm &&
      matchesStatus &&
      matchesRegion &&
      matchesCity &&
      matchesStage &&
      matchesFinishing &&
      matchesContract &&
      matchesConstruction &&
      matchesReadiness &&
      matchesPriceMin &&
      matchesPriceMax &&
      matchesLandMin &&
      matchesLandMax &&
      matchesHouseMin &&
      matchesHouseMax
    );
  });
});

const page = ref(1);
const pageSize = ref(12);

const pagedItems = computed(() => {
  const start = (page.value - 1) * pageSize.value;
  return filteredItems.value.slice(start, start + pageSize.value);
});

watch(
  () => filteredItems.value.length,
  () => {
    page.value = 1;
  }
);

const regions = computed(() =>
  Array.from(new Set(items.value.map((p) => p.region).filter(Boolean))).sort()
);
const cities = computed(() =>
  Array.from(new Set(items.value.map((p) => p.city).filter(Boolean))).sort()
);
const stages = computed(() =>
  Array.from(
    new Set(items.value.map((p) => p.buildStage).filter(Boolean))
  ).sort()
);

const finishingTypes = computed(() =>
  Array.from(
    new Set(items.value.map((p) => p.finishingType).filter(Boolean))
  ).sort()
);
const contractTypes = computed(() =>
  Array.from(
    new Set(items.value.map((p) => p.contractType).filter(Boolean))
  ).sort()
);
const constructionTypes = computed(() =>
  Array.from(
    new Set(items.value.map((p) => p.constructionType).filter(Boolean))
  ).sort()
);
const readinessTypes = computed(() =>
  Array.from(
    new Set(items.value.map((p) => p.readinessType).filter(Boolean))
  ).sort()
);

function isWithinLastDays(dateLike, days) {
  if (!dateLike) return false;
  const t = new Date(dateLike).getTime();
  if (Number.isNaN(t)) return false;
  return Date.now() - t <= days * 24 * 60 * 60 * 1000;
}

const analytics = computed(() => {
  const total = items.value.length;
  const available = items.value.filter(
    (p) => p.saleStatus === "available"
  ).length;
  const reserved = items.value.filter(
    (p) => p.saleStatus === "reserved"
  ).length;
  const sold = items.value.filter((p) => p.saleStatus === "sold").length;
  const createdLast7 = items.value.filter((p) =>
    isWithinLastDays(p.createdAt, 7)
  ).length;

  const availablePct = total ? Math.round((available / total) * 100) : 0;
  const soldPct = total ? Math.round((sold / total) * 100) : 0;

  return {
    total,
    available,
    reserved,
    sold,
    createdLast7,
    availablePct,
    soldPct,
  };
});

const analyticsScopeHint = computed(() =>
  isManager.value
    ? "Все объекты (включая бронь и проданные)"
    : "Только активные предложения"
);

onMounted(load);

async function load() {
  loading.value = true;
  try {
    const { data } = await apiClient.get("/properties");
    items.value = data;
  } catch (err) {
    ElMessage.error(err.response?.data?.error || "Не удалось загрузить");
  } finally {
    loading.value = false;
  }
}

async function createProperty() {
  try {
    if (!form.value.title || !form.value.region || !form.value.city) {
      ElMessage.error("Заполните название, регион и город");
      return;
    }

    if (isAdmin.value && !form.value.developerId) {
      ElMessage.error("Выберите застройщика");
      return;
    }

    const payload = { ...form.value };
    const { data } = await apiClient.post("/properties", payload);
    items.value.unshift(data);
    ElMessage.success("Объект создан");
    form.value = {
      developerId: "",
      title: "",
      region: "",
      city: "",
      street: "",
      plotNumber: "",
      landArea: "",
      houseArea: "",
      price: "",
    };
  } catch (err) {
    ElMessage.error(err.response?.data?.error || "Не удалось создать");
  }
}

async function applyToProperty(propertyId) {
  try {
    await apiClient.post("/applications", {
      propertyId,
      comment: applicationComments.value[propertyId] || "",
    });
    ElMessage.success("Заявка отправлена");
    applicationComments.value[propertyId] = "";
  } catch (err) {
    ElMessage.error(err.response?.data?.error || "Не удалось отправить заявку");
  }
}

function onFiltersApply(payload) {
  filters.value = payload;
  page.value = 1;
}
function onFiltersReset() {
  filters.value = {
    search: "",
    region: "",
    city: "",
    status: "",
    buildStage: "",
    finishingType: "",
    contractType: "",
    constructionType: "",
    readinessType: "",
    priceMin: null,
    priceMax: null,
    landMin: null,
    landMax: null,
    houseMin: null,
    houseMax: null,
  };
  page.value = 1;
}

async function updatePropertyStatus(property, status) {
  const prev = property.saleStatus;
  property.saleStatus = status;
  try {
    await apiClient.patch(`/properties/${property.id}`, { saleStatus: status });
    ElMessage.success("Статус обновлен");
  } catch (err) {
    property.saleStatus = prev;
    ElMessage.error(err.response?.data?.error || "Не удалось обновить статус");
  }
}

function goDetails(propertyId) {
  router.push(`/properties/${propertyId}`);
}
</script>

<template>
  <div class="page">
    <div class="section-head">
      <div>
        <div class="pill">Каталог</div>
        <h1 style="margin: 4px 0">Объекты ИЖС</h1>
        <div class="muted">
          Подберите готовые дома и участки — все заявки уходят в CRM.
        </div>
      </div>
      <el-button @click="load" :loading="loading" type="default"
        >Обновить</el-button
      >
    </div>

    <el-row :gutter="16" style="margin-bottom: var(--gap-md)">
      <el-col :span="8" :xs="24" :sm="12" :md="8">
        <AnalyticsWidget
          label="Объектов в базе"
          :value="String(analytics.total)"
          :delta="`+${analytics.createdLast7} за 7 дней`"
          :hint="analyticsScopeHint"
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

    <FiltersBar
      :regions="regions"
      :cities="cities"
      :stages="stages"
      :finishingTypes="finishingTypes"
      :contractTypes="contractTypes"
      :constructionTypes="constructionTypes"
      :readinessTypes="readinessTypes"
      @apply="onFiltersApply"
      @reset="onFiltersReset"
      style="margin-bottom: var(--gap-md)"
    />

    <el-card
      v-if="isManager"
      class="lift-hover"
      shadow="never"
      style="margin: var(--gap-md) 0"
    >
      <template #header>
        <div class="section-head" style="margin: 0">
          <div>
            <div class="pill">Застройщик</div>
            <div style="font-weight: 700">Добавить объект</div>
          </div>
          <el-button type="primary" @click="createProperty"
            >Сохранить</el-button
          >
        </div>
      </template>
      <el-form :model="form" label-position="top">
        <el-row :gutter="12">
          <el-col v-if="isAdmin" :span="12" :xs="24" :sm="12" :md="8">
            <el-form-item label="Застройщик">
              <el-select
                v-model="form.developerId"
                placeholder="Выберите застройщика"
                filterable
                remote
                reserve-keyword
                :remote-method="searchDevelopers"
                :loading="developerLoading"
                style="width: 100%"
              >
                <el-option
                  v-for="d in developerOptions"
                  :key="d.id"
                  :label="developerLabel(d)"
                  :value="d.id"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12" :xs="24" :sm="12" :md="8">
            <el-form-item label="Название">
              <el-input v-model="form.title" placeholder="Название объекта" />
            </el-form-item>
          </el-col>
          <el-col :span="12" :xs="24" :sm="12" :md="8">
            <el-form-item label="Регион">
              <el-input v-model="form.region" placeholder="Московская обл." />
            </el-form-item>
          </el-col>
          <el-col :span="12" :xs="24" :sm="12" :md="8">
            <el-form-item label="Город">
              <el-input v-model="form.city" placeholder="Москва" />
            </el-form-item>
          </el-col>
          <el-col :span="12" :xs="24" :sm="12" :md="8">
            <el-form-item label="Улица">
              <el-input v-model="form.street" placeholder="Ленина" />
            </el-form-item>
          </el-col>
          <el-col :span="12" :xs="24" :sm="12" :md="8">
            <el-form-item label="№ участка">
              <el-input v-model="form.plotNumber" placeholder="1" />
            </el-form-item>
          </el-col>
          <el-col :span="12" :xs="24" :sm="12" :md="8">
            <el-form-item label="Площадь участка (соток)">
              <el-input v-model.number="form.landArea" type="number" />
            </el-form-item>
          </el-col>
          <el-col :span="12" :xs="24" :sm="12" :md="8">
            <el-form-item label="Площадь дома (м²)">
              <el-input v-model.number="form.houseArea" type="number" />
            </el-form-item>
          </el-col>
          <el-col :span="12" :xs="24" :sm="12" :md="8">
            <el-form-item label="Цена (₽)">
              <el-input v-model.number="form.price" type="number" />
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
    </el-card>

    <div style="margin-bottom: var(--gap-md)" v-loading="loading">
      <CardsList>
        <SearchResultsCard v-for="p in pagedItems" :key="p.id" :property="p">
          <template #actions>
            <el-button type="warning" plain @click="goDetails(p.id)"
              >Детали</el-button
            >
            <template v-if="isAgent">
              <el-input
                v-model="applicationComments[p.id]"
                :rows="2"
                type="textarea"
                placeholder="Комментарий к заявке"
                style="flex: 1; min-width: 220px"
              />
              <el-button type="primary" @click="applyToProperty(p.id)"
                >Подать заявку</el-button
              >
            </template>
            <template v-else-if="isManager">
              <el-select
                v-model="p.saleStatus"
                placeholder="Статус"
                style="width: 160px"
                @change="(val) => updatePropertyStatus(p, val)"
              >
                <el-option
                  v-for="opt in statusOptions"
                  :key="opt.value"
                  :label="opt.label"
                  :value="opt.value"
                />
              </el-select>
            </template>
          </template>
        </SearchResultsCard>
      </CardsList>
    </div>

    <div
      v-if="filteredItems.length > pageSize"
      style="display: flex; justify-content: center; margin-top: var(--gap-md)"
    >
      <el-pagination
        v-model:current-page="page"
        v-model:page-size="pageSize"
        :total="filteredItems.length"
        :page-sizes="[12, 24, 48]"
        layout="total, sizes, prev, pager, next"
      />
    </div>
  </div>
</template>
