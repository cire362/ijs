<script setup>
import { onMounted, ref, computed, watch, nextTick } from "vue";
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
const isDeveloper = computed(() => auth.user?.role === "developer");

const activeTab = ref("catalog");

const developers = ref([]);
const developersListLoading = ref(false);
const selectedDeveloper = ref(null);
const statusOptions = [
  { value: "available", label: "Свободен" },
  { value: "reserved", label: "Бронь" },
  { value: "sold", label: "Продан" },
];

const filters = ref({
  search: "",
  developerId: "",
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

const developerFilterOptions = computed(() => {
  const byId = new Map();
  for (const p of items.value) {
    const d = p?.developer;
    if (!d?.id) continue;
    const id = String(d.id);
    if (byId.has(id)) continue;
    byId.set(id, { value: id, label: developerLabel(d) });
  }
  return Array.from(byId.values()).sort((a, b) =>
    String(a.label || "").localeCompare(String(b.label || ""), "ru")
  );
});

const filteredItems = computed(() => {
  const term = filters.value.search.toLowerCase();
  return items.value.filter((p) => {
    const matchesDeveloper =
      !filters.value.developerId ||
      String(p?.developer?.id || "") === String(filters.value.developerId);

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
      matchesDeveloper &&
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

const resultsTop = ref(null);

function scrollToResultsTop() {
  nextTick(() => {
    resultsTop.value?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

watch(
  () => page.value,
  () => {
    scrollToResultsTop();
  }
);

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

const agentScopeItems = computed(() => {
  const devId = filters.value.developerId;
  if (!devId) return items.value;
  return items.value.filter(
    (p) => String(p?.developer?.id || "") === String(devId)
  );
});

const agentAnalytics = computed(() => {
  const base = agentScopeItems.value;
  const total = base.length;
  const available = base.filter((p) => p.saleStatus === "available").length;
  const reserved = base.filter((p) => p.saleStatus === "reserved").length;
  const sold = base.filter((p) => p.saleStatus === "sold").length;
  const createdLast7 = base.filter((p) =>
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

const analyticsScopeHint = computed(
  () => "Все объекты (включая бронь и проданные)"
);

onMounted(load);

watch(
  () => activeTab.value,
  (tab) => {
    if (
      tab === "developers" &&
      isAdmin.value &&
      developers.value.length === 0
    ) {
      loadDevelopersList();
    }
  },
  { immediate: true }
);

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

async function loadDevelopersList() {
  developersListLoading.value = true;
  try {
    const { data } = await apiClient.get("/users/developers", {
      params: { q: "" },
    });
    developers.value = Array.isArray(data) ? data : [];
  } catch (err) {
    developers.value = [];
  } finally {
    developersListLoading.value = false;
  }
}

function resetCreateForm(preservedDeveloperId = "") {
  form.value = {
    developerId: preservedDeveloperId,
    title: "",
    region: "",
    city: "",
    street: "",
    plotNumber: "",
    landArea: "",
    houseArea: "",
    price: "",
  };
}

function openDeveloper(dev) {
  selectedDeveloper.value = dev;
  devQ.value = "";
  devStatus.value = "";
  resetCreateForm(String(dev?.id || ""));
}

function backToDevelopers() {
  selectedDeveloper.value = null;
  devQ.value = "";
  devStatus.value = "";
  resetCreateForm("");
}

function developerCardSubtitle(dev) {
  return dev?.companyName || developerLabel(dev) || dev?.email || "—";
}

const myProperties = computed(() => {
  const myId = auth.user?.id;
  if (!myId) return [];
  return items.value.filter((p) => p?.developer?.id === myId);
});

const myQ = ref("");
const myStatus = ref("");

function normalizeText(v) {
  return String(v || "")
    .toLowerCase()
    .trim();
}

const filteredMyProperties = computed(() => {
  const qq = normalizeText(myQ.value);
  return myProperties.value.filter((p) => {
    if (myStatus.value && p.saleStatus !== myStatus.value) return false;
    if (!qq) return true;
    const hay = [p.id, p.title, p.region, p.city, p.street, p.plotNumber]
      .filter(Boolean)
      .map((x) => normalizeText(x))
      .join(" ");
    return hay.includes(qq);
  });
});

const selectedDeveloperProperties = computed(() => {
  const devId = selectedDeveloper.value?.id;
  if (!devId) return [];
  return items.value.filter((p) => p?.developer?.id === devId);
});

const devQ = ref("");
const devStatus = ref("");

const filteredSelectedDeveloperProperties = computed(() => {
  const qq = normalizeText(devQ.value);
  return selectedDeveloperProperties.value.filter((p) => {
    if (devStatus.value && p.saleStatus !== devStatus.value) return false;
    if (!qq) return true;
    const hay = [p.id, p.title, p.region, p.city, p.street, p.plotNumber]
      .filter(Boolean)
      .map((x) => normalizeText(x))
      .join(" ");
    return hay.includes(qq);
  });
});

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
    const preservedDeveloperId = isAdmin.value ? form.value.developerId : "";
    resetCreateForm(preservedDeveloperId);
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
    developerId: "",
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

    <template v-if="!isManager">
      <el-row :gutter="16" style="margin-bottom: var(--gap-md)">
        <el-col :span="8" :xs="24" :sm="12" :md="8">
          <AnalyticsWidget
            label="Объектов в базе"
            :value="String(agentAnalytics.total)"
            :delta="`+${agentAnalytics.createdLast7} за 7 дней`"
            :hint="analyticsScopeHint"
          />
        </el-col>
        <el-col :span="8" :xs="24" :sm="12" :md="8">
          <AnalyticsWidget
            label="Свободны"
            :value="String(agentAnalytics.available)"
            :delta="`${agentAnalytics.availablePct}% от базы`"
            hint="Можно бронировать"
          />
        </el-col>
        <el-col :span="8" :xs="24" :sm="12" :md="8">
          <AnalyticsWidget
            label="В работе (бронь)"
            :value="String(agentAnalytics.reserved)"
            :delta="`${agentAnalytics.sold} продано`"
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
        :developerOptions="developerFilterOptions"
        @apply="onFiltersApply"
        @reset="onFiltersReset"
        style="margin-bottom: var(--gap-md)"
      />

      <div class="muted" style="margin-bottom: 8px">
        Всего: {{ agentScopeItems.length }} · Найдено:
        {{ filteredItems.length }}
      </div>

      <div ref="resultsTop" />
      <div style="margin-bottom: var(--gap-md)" v-loading="loading">
        <CardsList>
          <SearchResultsCard v-for="p in pagedItems" :key="p.id" :property="p">
            <template #actions>
              <el-button type="warning" plain @click="goDetails(p.id)"
                >Детали</el-button
              >
              <template v-if="isAgent && p.saleStatus === 'available'">
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
            </template>
          </SearchResultsCard>
        </CardsList>
      </div>

      <div
        v-if="filteredItems.length > pageSize"
        style="
          display: flex;
          justify-content: center;
          margin-top: var(--gap-md);
        "
      >
        <el-pagination
          v-model:current-page="page"
          v-model:page-size="pageSize"
          :total="filteredItems.length"
          :page-sizes="[5, 12, 24, 48]"
          layout="total, sizes, prev, pager, next"
        />
      </div>
    </template>

    <template v-else>
      <el-tabs v-model="activeTab" style="margin-top: var(--gap-md)">
        <el-tab-pane label="Поиск" name="catalog">
          <el-row :gutter="16" style="margin-bottom: var(--gap-md)">
            <el-col :span="8" :xs="24" :sm="12" :md="8">
              <AnalyticsWidget
                label="Объектов в базе"
                :value="String(agentAnalytics.total)"
                :delta="`+${agentAnalytics.createdLast7} за 7 дней`"
                :hint="analyticsScopeHint"
              />
            </el-col>
            <el-col :span="8" :xs="24" :sm="12" :md="8">
              <AnalyticsWidget
                label="Свободны"
                :value="String(agentAnalytics.available)"
                :delta="`${agentAnalytics.availablePct}% от базы`"
                hint="Можно бронировать"
              />
            </el-col>
            <el-col :span="8" :xs="24" :sm="12" :md="8">
              <AnalyticsWidget
                label="В работе (бронь)"
                :value="String(agentAnalytics.reserved)"
                :delta="`${agentAnalytics.sold} продано`"
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
            :developerOptions="developerFilterOptions"
            @apply="onFiltersApply"
            @reset="onFiltersReset"
            style="margin-bottom: var(--gap-md)"
          />

          <div class="muted" style="margin-bottom: 8px">
            Всего: {{ agentScopeItems.length }} · Найдено:
            {{ filteredItems.length }}
          </div>

          <div ref="resultsTop" />
          <div style="margin-bottom: var(--gap-md)" v-loading="loading">
            <CardsList>
              <SearchResultsCard
                v-for="p in pagedItems"
                :key="p.id"
                :property="p"
              >
                <template #actions>
                  <el-button type="warning" plain @click="goDetails(p.id)"
                    >Детали</el-button
                  >

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
              </SearchResultsCard>
            </CardsList>
          </div>

          <div
            v-if="filteredItems.length > pageSize"
            style="
              display: flex;
              justify-content: center;
              margin-top: var(--gap-md);
            "
          >
            <el-pagination
              v-model:current-page="page"
              v-model:page-size="pageSize"
              :total="filteredItems.length"
              :page-sizes="[5, 12, 24, 48]"
              layout="total, sizes, prev, pager, next"
            />
          </div>
        </el-tab-pane>

        <el-tab-pane v-if="isDeveloper" label="Мои объекты" name="my">
          <el-card shadow="never" style="margin-bottom: var(--gap-md)">
            <template #header>
              <div class="section-head" style="margin: 0">
                <div>
                  <div class="pill">Застройщик</div>
                  <div style="font-weight: 700">Создать объект</div>
                </div>
                <el-button type="primary" @click="createProperty"
                  >Сохранить</el-button
                >
              </div>
            </template>

            <el-form :model="form" label-position="top">
              <el-row :gutter="12">
                <el-col :span="12" :xs="24" :sm="12" :md="8">
                  <el-form-item label="Название">
                    <el-input
                      v-model="form.title"
                      placeholder="Название объекта"
                    />
                  </el-form-item>
                </el-col>
                <el-col :span="12" :xs="24" :sm="12" :md="8">
                  <el-form-item label="Регион">
                    <el-input
                      v-model="form.region"
                      placeholder="Московская обл."
                    />
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

          <el-card shadow="never" style="margin-bottom: var(--gap-md)">
            <div class="muted" style="margin-bottom: 8px">Фильтры</div>
            <div
              style="
                display: flex;
                gap: var(--gap-sm);
                flex-wrap: wrap;
                align-items: center;
              "
            >
              <el-input
                v-model="myQ"
                clearable
                placeholder="Поиск по названию/адресу/ID"
                style="min-width: 320px"
              />
              <el-select
                v-model="myStatus"
                clearable
                placeholder="Все статусы"
                style="min-width: 220px"
              >
                <el-option
                  v-for="opt in statusOptions"
                  :key="opt.value"
                  :label="opt.label"
                  :value="opt.value"
                />
              </el-select>
              <div class="muted">
                Найдено: {{ filteredMyProperties.length }}
              </div>
            </div>
          </el-card>

          <el-card shadow="never">
            <template #header>
              <div class="section-head" style="margin: 0">
                <div>
                  <div class="pill">Застройщик</div>
                  <div style="font-weight: 700">Мои объекты</div>
                </div>
                <div class="muted">
                  Всего: {{ myProperties.length }} · Найдено:
                  {{ filteredMyProperties.length }}
                </div>
              </div>
            </template>

            <div v-loading="loading">
              <CardsList>
                <SearchResultsCard
                  v-for="p in filteredMyProperties"
                  :key="p.id"
                  :property="p"
                >
                  <template #actions>
                    <el-button type="primary" plain @click="goDetails(p.id)"
                      >Редактировать</el-button
                    >
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
                </SearchResultsCard>
              </CardsList>
            </div>
          </el-card>
        </el-tab-pane>

        <el-tab-pane v-else-if="isAdmin" label="Застройщики" name="developers">
          <template v-if="!selectedDeveloper">
            <el-card shadow="never" style="margin-bottom: var(--gap-md)">
              <div class="section-head" style="margin: 0">
                <div>
                  <div class="pill">Админ</div>
                  <div style="font-weight: 700">Застройщики</div>
                </div>
                <el-button
                  type="default"
                  :loading="developersListLoading"
                  @click="loadDevelopersList"
                  >Обновить</el-button
                >
              </div>
            </el-card>

            <div v-loading="developersListLoading">
              <CardsList>
                <el-card
                  v-for="d in developers"
                  :key="d.id"
                  shadow="never"
                  class="lift-hover"
                  style="cursor: pointer"
                  @click="openDeveloper(d)"
                >
                  <div style="font-weight: 800">
                    {{ developerCardSubtitle(d) }}
                  </div>
                  <div class="muted" style="margin-top: 6px">
                    {{ d.email || "—" }}
                  </div>
                  <div class="muted" style="margin-top: 4px">
                    {{ d.phone || "—" }}
                  </div>
                </el-card>
              </CardsList>
            </div>
          </template>

          <template v-else>
            <el-card shadow="never" style="margin-bottom: var(--gap-md)">
              <div class="section-head" style="margin: 0">
                <div>
                  <div class="pill">Застройщик</div>
                  <div style="font-weight: 700">
                    {{ developerCardSubtitle(selectedDeveloper) }}
                  </div>
                </div>
                <el-button type="default" @click="backToDevelopers"
                  >Назад</el-button
                >
              </div>
            </el-card>

            <el-card shadow="never" style="margin-bottom: var(--gap-md)">
              <template #header>
                <div class="section-head" style="margin: 0">
                  <div>
                    <div class="pill">Админ</div>
                    <div style="font-weight: 700">Добавить объект</div>
                  </div>
                  <el-button type="primary" @click="createProperty"
                    >Сохранить</el-button
                  >
                </div>
              </template>

              <el-form :model="form" label-position="top">
                <el-row :gutter="12">
                  <el-col :span="12" :xs="24" :sm="12" :md="8">
                    <el-form-item label="Название">
                      <el-input
                        v-model="form.title"
                        placeholder="Название объекта"
                      />
                    </el-form-item>
                  </el-col>
                  <el-col :span="12" :xs="24" :sm="12" :md="8">
                    <el-form-item label="Регион">
                      <el-input
                        v-model="form.region"
                        placeholder="Московская обл."
                      />
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

            <el-card shadow="never" style="margin-bottom: var(--gap-md)">
              <div class="muted" style="margin-bottom: 8px">Фильтры</div>
              <div
                style="
                  display: flex;
                  gap: var(--gap-sm);
                  flex-wrap: wrap;
                  align-items: center;
                "
              >
                <el-input
                  v-model="devQ"
                  clearable
                  placeholder="Поиск по названию/адресу/ID"
                  style="min-width: 320px"
                />
                <el-select
                  v-model="devStatus"
                  clearable
                  placeholder="Все статусы"
                  style="min-width: 220px"
                >
                  <el-option
                    v-for="opt in statusOptions"
                    :key="opt.value"
                    :label="opt.label"
                    :value="opt.value"
                  />
                </el-select>
                <div class="muted">
                  Найдено: {{ filteredSelectedDeveloperProperties.length }}
                </div>
              </div>
            </el-card>

            <el-card shadow="never">
              <template #header>
                <div class="section-head" style="margin: 0">
                  <div>
                    <div class="pill">Застройщик</div>
                    <div style="font-weight: 700">Объекты</div>
                  </div>
                  <div class="muted">
                    Всего: {{ selectedDeveloperProperties.length }} · Найдено:
                    {{ filteredSelectedDeveloperProperties.length }}
                  </div>
                </div>
              </template>

              <div v-loading="loading">
                <CardsList>
                  <SearchResultsCard
                    v-for="p in filteredSelectedDeveloperProperties"
                    :key="p.id"
                    :property="p"
                  >
                    <template #actions>
                      <el-button type="primary" plain @click="goDetails(p.id)"
                        >Редактировать</el-button
                      >
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
                  </SearchResultsCard>
                </CardsList>
              </div>
            </el-card>
          </template>
        </el-tab-pane>
      </el-tabs>
    </template>
  </div>
</template>
