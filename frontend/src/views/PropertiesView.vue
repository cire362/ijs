<script setup>
import { onMounted, ref, computed, watch, nextTick } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore, apiClient } from "../stores/auth";
import { ElMessage } from "element-plus";
import { limits } from "@/utils/constraints";
import CardsList from "@/components/ui/CardsList.vue";
import SearchResultsCard from "@/components/ui/SearchResultsCard.vue";
import PropertiesAnalyticsRow from "@/components/properties/PropertiesAnalyticsRow.vue";
import PropertiesSearchSection from "@/components/properties/PropertiesSearchSection.vue";
import PropertyCreateFormCard from "@/components/properties/PropertyCreateFormCard.vue";
import SearchStatusFiltersCard from "@/components/ui/SearchStatusFiltersCard.vue";
import { normalizeText } from "@/utils/text";

const auth = useAuthStore();
const router = useRouter();
const items = ref([]);
const loading = ref(false);

const isAgent = computed(() => auth.user?.role === "agent");
const isManager = computed(
  () =>
    (auth.user?.role === "developer" && auth.user?.developerApproved) ||
    auth.user?.role === "admin"
);
const isAdmin = computed(() => auth.user?.role === "admin");
const isDeveloper = computed(
  () => auth.user?.role === "developer" && auth.user?.developerApproved
);
const isDeveloperRole = computed(() => auth.user?.role === "developer");
const isDeveloperPending = computed(
  () => isDeveloperRole.value && auth.user?.developerApproved === false
);

const activeTab = ref("catalog");

const developers = ref([]);
const developersListLoading = ref(false);
const selectedDeveloper = ref(null);
const developersQ = ref("");

const pendingDevelopers = ref([]);
const pendingDevelopersLoading = ref(false);

const adminCreateDevLoading = ref(false);
const adminCreateDevForm = ref({
  companyName: "",
  email: "",
  phone: "",
  lastName: "",
  firstName: "",
  middleName: "",
  password: "",
});
const statusOptions = [
  { value: "available", label: "Свободен" },
  { value: "reserved", label: "Бронь" },
  { value: "sold", label: "Продан" },
];

const buildStageOptions = [
  "Котлован",
  "Фундамент",
  "Коробка",
  "Кровля",
  "Инженерные сети",
  "Отделка",
  "Готовый дом",
];

const constructionTypeOptions = [
  "Кирпич",
  "Газобетон",
  "Монолит",
  "Каркас",
  "Дерево",
  "СИП-панели",
];

const finishingTypeOptions = [
  "Без отделки",
  "Предчистовая",
  "Чистовая",
  "С ремонтом",
];

const contractTypeOptions = ["ДКП", "ДДУ", "Подряд", "Аренда", "Иное"];

const readinessTypeOptions = ["Строится", "Готовый дом", "Сдан"];

const registrationOptions = ["ИЖС", "СНТ", "ЛПХ", "ДНП", "Другое"];

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
  floors: "",
  rooms: "",
  buildStage: "",
  constructionType: "",
  finishingType: "",
  contractType: "",
  readinessType: "",
  registration: "",
  price: "",
  description: "",
});

const creatingProperty = ref(false);
const createImages = ref([]);

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
const applicationClientFullNames = ref({});
const applicationClientPhones = ref({});

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

function isHouseProperty(p) {
  if (!p) return false;
  const ha = Number(p.houseArea);
  if (!Number.isNaN(ha) && ha > 0) return true;
  if (p.rooms != null) return true;
  if (p.floors != null) return true;
  return false;
}

const agentScopeItems = computed(() => {
  const devId = filters.value.developerId;
  if (!devId) return items.value;
  return items.value.filter(
    (p) => String(p?.developer?.id || "") === String(devId)
  );
});

const agentAnalytics = computed(() => {
  const raw = agentScopeItems.value;
  const base = auth.user
    ? raw
    : raw.filter(
        (p) =>
          p.saleStatus === "available" ||
          (p.saleStatus === "reserved" && isHouseProperty(p))
      );
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

const analyticsScopeHint = computed(() => {
  if (!auth.user) return "Только доступные (и дома в брони)";
  if (isDeveloper.value) {
    return "Только ваши объекты (включая бронь и проданные)";
  }
  return "Все объекты (включая бронь и проданные)";
});

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

    if (
      tab === "developer_registration" &&
      isAdmin.value &&
      pendingDevelopers.value.length === 0
    ) {
      loadPendingDevelopers();
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

async function loadPendingDevelopers() {
  pendingDevelopersLoading.value = true;
  try {
    const { data } = await apiClient.get("/users/developers", {
      params: { status: "pending" },
    });
    pendingDevelopers.value = Array.isArray(data) ? data : [];
  } catch (err) {
    pendingDevelopers.value = [];
  } finally {
    pendingDevelopersLoading.value = false;
  }
}

async function approveDeveloper(dev) {
  try {
    await apiClient.patch(`/users/developers/${dev.id}/approve`);
    ElMessage.success("Застройщик подтверждён");
    await loadPendingDevelopers();
    await loadDevelopersList();
  } catch (err) {
    ElMessage.error(err.response?.data?.error || "Не удалось подтвердить");
  }
}

async function rejectDeveloper(dev) {
  try {
    await apiClient.patch(`/users/developers/${dev.id}/reject`);
    ElMessage.success("Заявка отклонена");
    await loadPendingDevelopers();
  } catch (err) {
    ElMessage.error(err.response?.data?.error || "Не удалось отклонить");
  }
}

async function deleteDeveloperRequest(dev) {
  const ok = window.confirm(
    "Удалить заявку и аккаунт застройщика? Действие необратимо."
  );
  if (!ok) return;
  try {
    await apiClient.delete(`/users/developers/${dev.id}`);
    ElMessage.success("Заявка удалена");
    await loadPendingDevelopers();
  } catch (err) {
    ElMessage.error(err.response?.data?.error || "Не удалось удалить");
  }
}

function resetAdminCreateDevForm() {
  adminCreateDevForm.value = {
    companyName: "",
    email: "",
    phone: "",
    lastName: "",
    firstName: "",
    middleName: "",
    password: "",
  };
}

async function adminCreateDeveloper() {
  if (!adminCreateDevForm.value.email || !adminCreateDevForm.value.password) {
    ElMessage.error("Укажите email и пароль");
    return;
  }

  if (!String(adminCreateDevForm.value.phone || "").trim()) {
    ElMessage.error("Укажите телефон");
    return;
  }

  adminCreateDevLoading.value = true;
  try {
    await apiClient.post("/users/developers", { ...adminCreateDevForm.value });
    ElMessage.success("Застройщик создан");
    resetAdminCreateDevForm();
    await loadDevelopersList();
  } catch (err) {
    ElMessage.error(err.response?.data?.error || "Не удалось создать");
  } finally {
    adminCreateDevLoading.value = false;
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
    floors: "",
    rooms: "",
    buildStage: "",
    constructionType: "",
    finishingType: "",
    contractType: "",
    readinessType: "",
    registration: "",
    price: "",
    description: "",
  };

  createImages.value = [];
}

function openDeveloper(dev) {
  selectedDeveloper.value = dev;
  devQ.value = "";
  devStatus.value = "";
  developersQ.value = "";
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

// normalizeText вынесен в utils

const filteredDevelopers = computed(() => {
  const qq = normalizeText(developersQ.value);
  if (!qq) return developers.value;
  return developers.value.filter((d) => {
    const hay = [d?.companyName, d?.fullName, d?.email, d?.phone, d?.id]
      .filter(Boolean)
      .map((x) => normalizeText(x))
      .join(" ");
    return hay.includes(qq);
  });
});

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
  if (creatingProperty.value) return;
  creatingProperty.value = true;
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
    const { data: created } = await apiClient.post("/properties", payload);

    let finalProperty = created;
    if (Array.isArray(createImages.value) && createImages.value.length) {
      const fd = new FormData();
      for (const f of createImages.value) {
        if (f?.raw) fd.append("images", f.raw);
      }
      if ([...fd.keys()].length) {
        try {
          const { data: full } = await apiClient.post(
            `/properties/${created.id}/images`,
            fd,
            { headers: { "Content-Type": "multipart/form-data" } }
          );
          finalProperty = full;
          ElMessage.success("Объект создан и изображения загружены");
        } catch (err) {
          ElMessage.error(
            err.response?.data?.error ||
              "Объект создан, но не удалось загрузить изображения"
          );
        }
      }
    }

    items.value.unshift(finalProperty);
    if (finalProperty === created) {
      ElMessage.success("Объект создан");
    }
    const preservedDeveloperId = isAdmin.value ? form.value.developerId : "";
    resetCreateForm(preservedDeveloperId);
  } catch (err) {
    ElMessage.error(err.response?.data?.error || "Не удалось создать");
  } finally {
    creatingProperty.value = false;
  }
}

async function applyToProperty(propertyId) {
  const fio = String(applicationClientFullNames.value[propertyId] || "").trim();
  const phone = String(applicationClientPhones.value[propertyId] || "").trim();
  if (!fio) {
    ElMessage.error("Укажите ФИО клиента");
    return;
  }
  if (!phone) {
    ElMessage.error("Укажите телефон клиента");
    return;
  }
  try {
    await apiClient.post("/applications", {
      propertyId,
      clientFullName: fio,
      clientPhone: phone,
      comment: applicationComments.value[propertyId] || "",
    });
    ElMessage.success("Заявка отправлена");
    applicationComments.value[propertyId] = "";
    applicationClientFullNames.value[propertyId] = "";
    applicationClientPhones.value[propertyId] = "";
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
        <div class="pill">{{ isDeveloperRole ? "Застройщик" : "Каталог" }}</div>
        <h1 style="margin: 4px 0">
          {{ isDeveloperRole ? "Мои объекты" : "Объекты ИЖС" }}
        </h1>
        <div class="muted">
          {{
            isDeveloperRole
              ? "Управляйте своими объектами"
              : "Подберите готовые дома и участки"
          }}
        </div>
      </div>
      <el-button @click="load" :loading="loading" type="default"
        >Обновить</el-button
      >
    </div>

    <el-card
      v-if="isDeveloperPending"
      shadow="never"
      style="margin-top: var(--gap-md)"
    >
      <template #header>
        <div class="section-head" style="margin: 0">
          <div>
            <div class="pill">Застройщик</div>
            <div style="font-weight: 700">Доступ ограничен</div>
          </div>
        </div>
      </template>

      <div class="muted">
        Дождитесь подтверждения администратора. После подтверждения появится
        доступ к созданию и управлению объектами.
      </div>
    </el-card>

    <template v-else-if="!isManager">
      <PropertiesAnalyticsRow
        :analytics="agentAnalytics"
        :scopeHint="analyticsScopeHint"
      />

      <PropertiesSearchSection
        v-model:page="page"
        v-model:pageSize="pageSize"
        :regions="regions"
        :cities="cities"
        :stages="stages"
        :finishingTypes="finishingTypes"
        :contractTypes="contractTypes"
        :constructionTypes="constructionTypes"
        :readinessTypes="readinessTypes"
        :developerOptions="developerFilterOptions"
        :loading="loading"
        :totalAll="agentScopeItems.length"
        :totalFound="filteredItems.length"
        :pagedItems="pagedItems"
        @filters-apply="onFiltersApply"
        @filters-reset="onFiltersReset"
      >
        <template #resultsTop>
          <div ref="resultsTop" />
        </template>
        <template #actions="{ property: p }">
          <el-button type="warning" plain @click="goDetails(p.id)"
            >Детали</el-button
          >
          <template v-if="isAgent && p.saleStatus === 'available'">
            <el-input
              v-model="applicationClientFullNames[p.id]"
              placeholder="ФИО клиента"
              :maxlength="limits.application.clientFullName"
              style="flex: 1; min-width: 200px"
            />
            <el-input
              v-model="applicationClientPhones[p.id]"
              placeholder="Телефон клиента"
              :maxlength="limits.application.clientPhone"
              style="flex: 1; min-width: 180px"
            />
            <el-input
              v-model="applicationComments[p.id]"
              :rows="2"
              type="textarea"
              placeholder="Комментарий к заявке"
              :maxlength="limits.application.comment"
              style="flex: 1; min-width: 220px"
            />
            <el-button type="primary" @click="applyToProperty(p.id)"
              >Подать заявку</el-button
            >
          </template>
        </template>
      </PropertiesSearchSection>
    </template>

    <template v-else>
      <el-tabs v-model="activeTab" style="margin-top: var(--gap-md)">
        <el-tab-pane
          :label="isDeveloper ? 'Мои объекты' : 'Поиск'"
          name="catalog"
        >
          <PropertiesAnalyticsRow
            :analytics="agentAnalytics"
            :scopeHint="analyticsScopeHint"
          />

          <PropertiesSearchSection
            v-model:page="page"
            v-model:pageSize="pageSize"
            :regions="regions"
            :cities="cities"
            :stages="stages"
            :finishingTypes="finishingTypes"
            :contractTypes="contractTypes"
            :constructionTypes="constructionTypes"
            :readinessTypes="readinessTypes"
            :developerOptions="developerFilterOptions"
            :loading="loading"
            :totalAll="agentScopeItems.length"
            :totalFound="filteredItems.length"
            :pagedItems="pagedItems"
            @filters-apply="onFiltersApply"
            @filters-reset="onFiltersReset"
          >
            <template #resultsTop>
              <div ref="resultsTop" />
            </template>
            <template #actions="{ property: p }">
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
          </PropertiesSearchSection>
        </el-tab-pane>

        <el-tab-pane v-if="isDeveloper" label="Добавить объект" name="my">
          <PropertyCreateFormCard
            v-model:form="form"
            v-model:images="createImages"
            pill="Застройщик"
            title="Добавить объект"
            :saving="creatingProperty"
            :buildStageOptions="buildStageOptions"
            :constructionTypeOptions="constructionTypeOptions"
            :finishingTypeOptions="finishingTypeOptions"
            :contractTypeOptions="contractTypeOptions"
            :readinessTypeOptions="readinessTypeOptions"
            :registrationOptions="registrationOptions"
            @save="createProperty"
          />
        </el-tab-pane>

        <el-tab-pane
          v-if="isAdmin"
          label="Регистрация застройщика"
          name="developer_registration"
        >
          <el-card shadow="never" style="margin-bottom: var(--gap-md)">
            <template #header>
              <div class="section-head" style="margin: 0">
                <div>
                  <div class="pill">Админ</div>
                  <div style="font-weight: 700">Создать застройщика</div>
                </div>
                <el-button
                  type="primary"
                  :loading="adminCreateDevLoading"
                  @click="adminCreateDeveloper"
                  >Создать</el-button
                >
              </div>
            </template>

            <el-form :model="adminCreateDevForm" label-position="top">
              <el-row :gutter="12">
                <el-col :span="12" :xs="24" :sm="12" :md="8">
                  <el-form-item label="Компания">
                    <el-input v-model="adminCreateDevForm.companyName" />
                  </el-form-item>
                </el-col>
                <el-col :span="12" :xs="24" :sm="12" :md="8">
                  <el-form-item label="Email">
                    <el-input v-model="adminCreateDevForm.email" />
                  </el-form-item>
                </el-col>
                <el-col :span="12" :xs="24" :sm="12" :md="8">
                  <el-form-item label="Телефон">
                    <el-input v-model="adminCreateDevForm.phone" />
                  </el-form-item>
                </el-col>
                <el-col :span="12" :xs="24" :sm="12" :md="8">
                  <el-form-item label="Фамилия">
                    <el-input v-model="adminCreateDevForm.lastName" />
                  </el-form-item>
                </el-col>
                <el-col :span="12" :xs="24" :sm="12" :md="8">
                  <el-form-item label="Имя">
                    <el-input v-model="adminCreateDevForm.firstName" />
                  </el-form-item>
                </el-col>
                <el-col :span="12" :xs="24" :sm="12" :md="8">
                  <el-form-item label="Отчество">
                    <el-input v-model="adminCreateDevForm.middleName" />
                  </el-form-item>
                </el-col>
                <el-col :span="12" :xs="24" :sm="12" :md="8">
                  <el-form-item label="Пароль">
                    <el-input
                      v-model="adminCreateDevForm.password"
                      type="password"
                      show-password
                    />
                  </el-form-item>
                </el-col>
              </el-row>
            </el-form>
          </el-card>

          <el-card shadow="never" style="margin-bottom: var(--gap-md)">
            <div class="section-head" style="margin: 0">
              <div>
                <div class="pill">Админ</div>
                <div style="font-weight: 700">Регистрация застройщика</div>
              </div>
              <el-button
                type="default"
                :loading="pendingDevelopersLoading"
                @click="loadPendingDevelopers"
                >Обновить</el-button
              >
            </div>
            <div class="muted" style="margin-top: 8px">
              Ожидают подтверждения: {{ pendingDevelopers.length }}
            </div>
          </el-card>

          <div v-loading="pendingDevelopersLoading">
            <el-empty
              v-if="!pendingDevelopersLoading && pendingDevelopers.length === 0"
              description="Нет заявок на подтверждение"
            />
            <CardsList v-else>
              <el-card
                v-for="d in pendingDevelopers"
                :key="d.id"
                shadow="never"
              >
                <div class="dev-reg-card">
                  <div class="dev-reg-main">
                    <div class="dev-reg-title">
                      {{ developerCardSubtitle(d) }}
                    </div>
                    <div class="muted" style="margin-top: 6px">
                      {{ d.email || "—" }}
                    </div>
                    <div class="muted" style="margin-top: 4px">
                      {{ d.phone || "—" }}
                    </div>
                  </div>

                  <div class="dev-reg-actions">
                    <el-button type="primary" @click="approveDeveloper(d)"
                      >Подтвердить</el-button
                    >
                    <el-button type="warning" plain @click="rejectDeveloper(d)"
                      >Отклонить</el-button
                    >
                    <el-button
                      type="danger"
                      plain
                      @click="deleteDeveloperRequest(d)"
                      >Удалить заявку</el-button
                    >
                  </div>
                </div>
              </el-card>
            </CardsList>
          </div>
        </el-tab-pane>

        <el-tab-pane v-if="isAdmin" label="Застройщики" name="developers">
          <template v-if="!selectedDeveloper">
            <el-card shadow="never" style="margin-bottom: var(--gap-md)">
              <div class="section-head" style="margin: 0">
                <div>
                  <div class="pill">Админ</div>
                  <div style="font-weight: 700">Застройщики</div>
                </div>
                <div
                  style="display: flex; gap: var(--gap-sm); align-items: center"
                >
                  <el-input
                    v-model="developersQ"
                    clearable
                    placeholder="Поиск по названию застройщика"
                    style="min-width: 320px"
                  />
                  <el-button
                    type="default"
                    :loading="developersListLoading"
                    @click="loadDevelopersList"
                    >Обновить</el-button
                  >
                </div>
              </div>
              <div class="muted" style="margin-top: 8px">
                Найдено: {{ filteredDevelopers.length }}
              </div>
            </el-card>

            <div v-loading="developersListLoading">
              <CardsList>
                <el-card
                  v-for="d in filteredDevelopers"
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

            <PropertyCreateFormCard
              v-model:form="form"
              v-model:images="createImages"
              pill="Админ"
              title="Добавить объект"
              :saving="creatingProperty"
              :buildStageOptions="buildStageOptions"
              :constructionTypeOptions="constructionTypeOptions"
              :finishingTypeOptions="finishingTypeOptions"
              :contractTypeOptions="contractTypeOptions"
              :readinessTypeOptions="readinessTypeOptions"
              :registrationOptions="registrationOptions"
              @save="createProperty"
            />

            <SearchStatusFiltersCard
              v-model:q="devQ"
              v-model:status="devStatus"
              :options="statusOptions"
              :count="filteredSelectedDeveloperProperties.length"
              placeholder="Поиск по названию/адресу/ID"
            />

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

<style scoped>
.dev-reg-card {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--gap-md);
  flex-wrap: wrap;
}

.dev-reg-main {
  min-width: 240px;
  flex: 1 1 320px;
}

.dev-reg-title {
  font-weight: 800;
  overflow-wrap: anywhere;
}

.dev-reg-actions {
  display: flex;
  gap: var(--gap-sm);
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  flex: 0 1 520px;
}
</style>
