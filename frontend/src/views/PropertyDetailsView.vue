<script setup>
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import { limits } from "@/utils/constraints";
import { apiClient, useAuthStore } from "@/stores/auth";

const auth = useAuthStore();
const route = useRoute();
const router = useRouter();

const loading = ref(false);
const property = ref(null);
const uploading = ref(false);
const uploadingDoc = ref(false);

const regionLoading = ref(false);
const cityLoading = ref(false);
const streetLoading = ref(false);

let regionTimer;
let cityTimer;
let streetTimer;

async function fetchSuggestions(kind, q, extra = {}) {
  const qq = String(q || "").trim();
  if (qq.length < 2) return [];
  const params = { kind, q: qq, ...extra };
  const { data } = await apiClient.get("/address/suggest", { params });
  return Array.isArray(data) ? data : [];
}

function onSelectRegion(item) {
  editForm.value.region = item?.label || editForm.value.region;
}

function onSelectCity(item) {
  editForm.value.city = item?.label || editForm.value.city;
}

function onSelectStreet(item) {
  editForm.value.street = item?.label || editForm.value.street;
}

async function suggestRegions(queryString, cb) {
  regionLoading.value = true;
  try {
    const items = await new Promise((resolve) => {
      clearTimeout(regionTimer);
      regionTimer = setTimeout(async () => {
        try {
          resolve(await fetchSuggestions("region", queryString));
        } catch {
          resolve([]);
        }
      }, 250);
    });
    cb(items);
  } finally {
    regionLoading.value = false;
  }
}

async function suggestCities(queryString, cb) {
  cityLoading.value = true;
  try {
    const items = await new Promise((resolve) => {
      clearTimeout(cityTimer);
      cityTimer = setTimeout(async () => {
        try {
          resolve(
            await fetchSuggestions("city", queryString, {
              region: editForm.value.region || undefined,
            })
          );
        } catch {
          resolve([]);
        }
      }, 250);
    });
    cb(items);
  } finally {
    cityLoading.value = false;
  }
}

async function suggestStreets(queryString, cb) {
  streetLoading.value = true;
  try {
    const items = await new Promise((resolve) => {
      clearTimeout(streetTimer);
      streetTimer = setTimeout(async () => {
        try {
          resolve(
            await fetchSuggestions("street", queryString, {
              region: editForm.value.region || undefined,
              city: editForm.value.city || undefined,
            })
          );
        } catch {
          resolve([]);
        }
      }, 250);
    });
    cb(items);
  } finally {
    streetLoading.value = false;
  }
}

const editForm = ref({
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

const saving = ref(false);

const isAgent = computed(() => auth.user?.role === "agent");
const isManager = computed(
  () =>
    (auth.user?.role === "developer" && auth.user?.developerApproved) ||
    auth.user?.role === "admin"
);

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

const applicationComment = ref("");
const clientFullName = ref("");
const clientPhone = ref("");

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
    { label: "Регистрация", value: p.registration || "—" },
  ];
});

function imageSrc(url) {
  if (!url) return "";
  return url;
}

async function uploadPropertyImage({ file }) {
  if (!property.value?.id) return;
  uploading.value = true;
  try {
    const form = new FormData();
    form.append("images", file);
    await apiClient.post(`/properties/${property.value.id}/images`, form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    ElMessage.success("Изображение загружено");
    await load();
  } catch (err) {
    ElMessage.error(err.response?.data?.error || "Не удалось загрузить фото");
  } finally {
    uploading.value = false;
  }
}

async function uploadPropertyDoc(options) {
  if (!property.value?.id) return;
  uploadingDoc.value = true;
  try {
    const fd = new FormData();
    fd.append("document", options.file);
    await apiClient.post(`/properties/${property.value.id}/documents`, fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    ElMessage.success("Документ загружен");
    await load();
  } catch (e) {
    ElMessage.error(e.response?.data?.error || "Ошибка загрузки документа");
  } finally {
    uploadingDoc.value = false;
  }
}

async function deleteDoc(docId) {
  if (!confirm("Вы уверены, что хотите удалить документ?")) return;
  try {
    await apiClient.delete(`/properties/documents/${docId}`);
    ElMessage.success("Документ удален");
    await load();
  } catch (e) {
    ElMessage.error(e.response?.data?.error || "Ошибка удаления");
  }
}

async function load() {
  loading.value = true;
  property.value = null;
  try {
    const { data } = await apiClient.get(`/properties/${id.value}`);
    property.value = data;

    editForm.value = {
      title: data?.title || "",
      region: data?.region || "",
      city: data?.city || "",
      street: data?.street || "",
      plotNumber: data?.plotNumber || "",
      landArea: data?.landArea ?? "",
      houseArea: data?.houseArea ?? "",
      floors: data?.floors ?? "",
      rooms: data?.rooms ?? "",
      buildStage: data?.buildStage || "",
      constructionType: data?.constructionType || "",
      finishingType: data?.finishingType || "",
      contractType: data?.contractType || "",
      readinessType: data?.readinessType || "",
      registration: data?.registration || "",
      price: data?.price ?? "",
      description: data?.description || "",
    };
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
  const fio = String(clientFullName.value || "").trim();
  const phone = String(clientPhone.value || "").trim();
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
      propertyId: property.value.id,
      clientFullName: fio,
      clientPhone: phone,
      comment: applicationComment.value || "",
    });
    ElMessage.success("Заявка отправлена");
    clientFullName.value = "";
    clientPhone.value = "";
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

async function saveEdits() {
  if (!property.value?.id) return;
  if (!editForm.value.title || !editForm.value.region || !editForm.value.city) {
    ElMessage.error("Заполните название, регион и город");
    return;
  }

  saving.value = true;
  try {
    const payload = {
      title: editForm.value.title,
      region: editForm.value.region,
      city: editForm.value.city,
      street: editForm.value.street,
      plotNumber: editForm.value.plotNumber,
      landArea: editForm.value.landArea,
      houseArea: editForm.value.houseArea,
      floors: editForm.value.floors,
      rooms: editForm.value.rooms,
      buildStage: editForm.value.buildStage,
      constructionType: editForm.value.constructionType,
      finishingType: editForm.value.finishingType,
      contractType: editForm.value.contractType,
      readinessType: editForm.value.readinessType,
      registration: editForm.value.registration,
      price: editForm.value.price,
      description: editForm.value.description,
    };
    await apiClient.patch(`/properties/${property.value.id}`, payload);
    ElMessage.success("Изменения сохранены");
    await load();
  } catch (err) {
    ElMessage.error(err.response?.data?.error || "Не удалось сохранить");
  } finally {
    saving.value = false;
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

        <el-card
          v-if="isManager"
          shadow="never"
          style="margin-top: var(--gap-md)"
          v-loading="loading"
        >
          <template #header>
            <div class="section-head" style="margin: 0">
              <div>
                <div class="pill">Застройщик</div>
                <div style="font-weight: 700">Редактирование</div>
              </div>
              <el-button type="primary" :loading="saving" @click="saveEdits"
                >Сохранить</el-button
              >
            </div>
          </template>

          <el-form :model="editForm" label-position="top">
            <el-row :gutter="12">
              <el-col :span="12" :xs="24" :sm="12" :md="12">
                <el-form-item label="Название">
                  <el-input
                    v-model="editForm.title"
                    :maxlength="limits.property.title"
                  />
                </el-form-item>
              </el-col>
              <el-col :span="12" :xs="24" :sm="12" :md="12">
                <el-form-item label="Регион">
                  <el-autocomplete
                    v-model="editForm.region"
                    placeholder="Московская обл."
                    :maxlength="limits.property.region"
                    :fetch-suggestions="suggestRegions"
                    value-key="label"
                    :trigger-on-focus="false"
                    :debounce="0"
                    :loading="regionLoading"
                    @select="onSelectRegion"
                  />
                </el-form-item>
              </el-col>
              <el-col :span="12" :xs="24" :sm="12" :md="12">
                <el-form-item label="Город">
                  <el-autocomplete
                    v-model="editForm.city"
                    placeholder="Москва"
                    :maxlength="limits.property.city"
                    :fetch-suggestions="suggestCities"
                    value-key="label"
                    :trigger-on-focus="false"
                    :debounce="0"
                    :loading="cityLoading"
                    @select="onSelectCity"
                  />
                </el-form-item>
              </el-col>
              <el-col :span="12" :xs="24" :sm="12" :md="12">
                <el-form-item label="Улица">
                  <el-autocomplete
                    v-model="editForm.street"
                    placeholder="Ленина"
                    :maxlength="limits.property.street"
                    :fetch-suggestions="suggestStreets"
                    value-key="label"
                    :trigger-on-focus="false"
                    :debounce="0"
                    :loading="streetLoading"
                    @select="onSelectStreet"
                  />
                </el-form-item>
              </el-col>
              <el-col :span="12" :xs="24" :sm="12" :md="12">
                <el-form-item label="№ участка">
                  <el-input
                    v-model="editForm.plotNumber"
                    :maxlength="limits.property.plotNumber"
                  />
                </el-form-item>
              </el-col>
              <el-col :span="12" :xs="24" :sm="12" :md="12">
                <el-form-item label="Площадь участка (соток)">
                  <el-input v-model.number="editForm.landArea" type="number" />
                </el-form-item>
              </el-col>
              <el-col :span="12" :xs="24" :sm="12" :md="12">
                <el-form-item label="Площадь дома (м²)">
                  <el-input v-model.number="editForm.houseArea" type="number" />
                </el-form-item>
              </el-col>
              <el-col :span="12" :xs="24" :sm="12" :md="12">
                <el-form-item label="Цена (₽)">
                  <el-input v-model.number="editForm.price" type="number" />
                </el-form-item>
              </el-col>

              <el-col :span="12" :xs="24" :sm="12" :md="12">
                <el-form-item label="Этажность">
                  <el-input v-model.number="editForm.floors" type="number" />
                </el-form-item>
              </el-col>
              <el-col :span="12" :xs="24" :sm="12" :md="12">
                <el-form-item label="Комнат">
                  <el-input v-model.number="editForm.rooms" type="number" />
                </el-form-item>
              </el-col>
              <el-col :span="12" :xs="24" :sm="12" :md="12">
                <el-form-item label="Стадия строительства">
                  <el-select
                    v-model="editForm.buildStage"
                    clearable
                    filterable
                    placeholder="Выберите"
                    style="width: 100%"
                  >
                    <el-option
                      v-for="opt in buildStageOptions"
                      :key="opt"
                      :label="opt"
                      :value="opt"
                    />
                  </el-select>
                </el-form-item>
              </el-col>
              <el-col :span="12" :xs="24" :sm="12" :md="12">
                <el-form-item label="Конструкция">
                  <el-select
                    v-model="editForm.constructionType"
                    clearable
                    filterable
                    placeholder="Выберите"
                    style="width: 100%"
                  >
                    <el-option
                      v-for="opt in constructionTypeOptions"
                      :key="opt"
                      :label="opt"
                      :value="opt"
                    />
                  </el-select>
                </el-form-item>
              </el-col>
              <el-col :span="12" :xs="24" :sm="12" :md="12">
                <el-form-item label="Отделка">
                  <el-select
                    v-model="editForm.finishingType"
                    clearable
                    filterable
                    placeholder="Выберите"
                    style="width: 100%"
                  >
                    <el-option
                      v-for="opt in finishingTypeOptions"
                      :key="opt"
                      :label="opt"
                      :value="opt"
                    />
                  </el-select>
                </el-form-item>
              </el-col>
              <el-col :span="12" :xs="24" :sm="12" :md="12">
                <el-form-item label="Тип договора">
                  <el-select
                    v-model="editForm.contractType"
                    clearable
                    filterable
                    placeholder="Выберите"
                    style="width: 100%"
                  >
                    <el-option
                      v-for="opt in contractTypeOptions"
                      :key="opt"
                      :label="opt"
                      :value="opt"
                    />
                  </el-select>
                </el-form-item>
              </el-col>
              <el-col :span="12" :xs="24" :sm="12" :md="12">
                <el-form-item label="Готовность">
                  <el-select
                    v-model="editForm.readinessType"
                    clearable
                    filterable
                    placeholder="Выберите"
                    style="width: 100%"
                  >
                    <el-option
                      v-for="opt in readinessTypeOptions"
                      :key="opt"
                      :label="opt"
                      :value="opt"
                    />
                  </el-select>
                </el-form-item>
              </el-col>
              <el-col :span="12" :xs="24" :sm="12" :md="12">
                <el-form-item label="Регистрация">
                  <el-select
                    v-model="editForm.registration"
                    clearable
                    filterable
                    placeholder="Выберите"
                    style="width: 100%"
                  >
                    <el-option
                      v-for="opt in registrationOptions"
                      :key="opt"
                      :label="opt"
                      :value="opt"
                    />
                  </el-select>
                </el-form-item>
              </el-col>
              <el-col :span="24">
                <el-form-item label="Описание">
                  <el-input
                    v-model="editForm.description"
                    type="textarea"
                    :rows="4"
                  />
                </el-form-item>
              </el-col>
            </el-row>
          </el-form>
        </el-card>

        <el-card
          v-if="isManager"
          shadow="never"
          style="margin-top: var(--gap-md)"
          v-loading="loading"
        >
          <template v-if="property">
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
          </template>
        </el-card>

        <el-card
          v-if="isManager"
          shadow="never"
          style="margin-top: var(--gap-md)"
          v-loading="loading"
        >
          <div class="muted" style="margin-bottom: 8px">Фото объекта</div>
          <el-upload
            v-if="property"
            :http-request="uploadPropertyImage"
            :show-file-list="false"
            accept="image/png,image/jpeg,image/webp"
            :disabled="!property || uploading"
          >
            <el-button type="primary" plain :loading="uploading"
              >Загрузить фото</el-button
            >
          </el-upload>
          <div class="muted" style="margin-top: 8px">
            Поддерживаются JPG/PNG/WebP.
          </div>
        </el-card>

        <el-card
          v-if="isManager || isAgent"
          shadow="never"
          style="margin-top: var(--gap-md)"
          v-loading="loading"
        >
          <div class="muted" style="margin-bottom: 8px">Документы</div>
          <div
            v-if="property?.documents?.length"
            style="
              display: flex;
              flex-direction: column;
              gap: 8px;
              margin-bottom: 12px;
            "
          >
            <div
              v-for="doc in property.documents"
              :key="doc.id"
              style="
                display: flex;
                align-items: center;
                justify-content: space-between;
                border-bottom: 1px solid var(--border-color);
                padding-bottom: 4px;
              "
            >
              <a
                :href="doc.url"
                target="_blank"
                style="
                  color: var(--primary);
                  text-decoration: none;
                  overflow: hidden;
                  text-overflow: ellipsis;
                  white-space: nowrap;
                  max-width: 200px;
                "
                :title="doc.originalName"
              >
                {{ doc.originalName }}
              </a>
              <el-button
                v-if="isManager"
                type="danger"
                link
                size="small"
                @click="deleteDoc(doc.id)"
                >Удалить</el-button
              >
            </div>
          </div>
          <div
            v-else
            class="muted"
            style="margin-bottom: 12px; font-size: 13px"
          >
            Нет загруженных документов
          </div>

          <el-upload
            v-if="property && isManager"
            :http-request="uploadPropertyDoc"
            :show-file-list="false"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.jpg,.jpeg,.png"
            :disabled="!property || uploadingDoc"
          >
            <el-button type="primary" plain :loading="uploadingDoc"
              >Загрузить документ</el-button
            >
          </el-upload>
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
            v-model="clientFullName"
            placeholder="ФИО клиента"
            :maxlength="limits.application.clientFullName"
            style="margin-bottom: 8px"
          />
          <el-input
            v-model="clientPhone"
            placeholder="Телефон клиента"
            :maxlength="limits.application.clientPhone"
            style="margin-bottom: 8px"
          />
          <el-input
            v-model="applicationComment"
            :rows="3"
            type="textarea"
            placeholder="Комментарий к заявке"
            :maxlength="limits.application.comment"
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
