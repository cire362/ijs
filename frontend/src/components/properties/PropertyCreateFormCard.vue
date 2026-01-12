<script setup>
import { ref } from "vue";
import { ElMessage } from "element-plus";
import { limits } from "@/utils/constraints";
import { apiClient } from "@/stores/auth";

defineProps({
  pill: { type: String, default: "" },
  title: { type: String, default: "" },
  saveLabel: { type: String, default: "Сохранить" },
  saving: { type: Boolean, default: false },

  buildStageOptions: { type: Array, default: () => [] },
  constructionTypeOptions: { type: Array, default: () => [] },
  finishingTypeOptions: { type: Array, default: () => [] },
  contractTypeOptions: { type: Array, default: () => [] },
  readinessTypeOptions: { type: Array, default: () => [] },
  registrationOptions: { type: Array, default: () => [] },
});

const emit = defineEmits(["save"]);

const form = defineModel("form", { type: Object, required: true });
const images = defineModel("images", { type: Array, default: () => [] });
const documents = defineModel("documents", { type: Array, default: () => [] });

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
  form.value.region = item?.label || form.value.region;
}

function onSelectCity(item) {
  form.value.city = item?.label || form.value.city;
}

function onSelectStreet(item) {
  form.value.street = item?.label || form.value.street;
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
              region: form.value.region || undefined,
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
              region: form.value.region || undefined,
              city: form.value.city || undefined,
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

function onImagesExceed() {
  ElMessage.warning("Можно загрузить до 10 изображений");
}

function onImagesChange(file, fileList) {
  const raw = file?.raw;
  if (!raw) return;

  const okType = ["image/jpeg", "image/png", "image/webp"].includes(raw.type);
  if (!okType) {
    ElMessage.error("Допустимы только JPG/PNG/WEBP");
    images.value = (fileList || []).filter((f) => f.uid !== file.uid);
    return;
  }

  const maxSize = 6 * 1024 * 1024;
  if (raw.size > maxSize) {
    ElMessage.error("Файл слишком большой (макс 6 МБ)");
    images.value = (fileList || []).filter((f) => f.uid !== file.uid);
    return;
  }

  images.value = fileList || [];
}
</script>

<template>
  <el-card shadow="never" style="margin-bottom: var(--gap-md)">
    <template #header>
      <div class="section-head" style="margin: 0">
        <div>
          <div class="pill">{{ pill }}</div>
          <div style="font-weight: 700">{{ title }}</div>
        </div>
        <el-button type="primary" @click="emit('save')" :loading="saving">
          {{ saveLabel }}
        </el-button>
      </div>
    </template>

    <el-form :model="form" label-position="top">
      <el-row :gutter="12">
        <el-col :span="12" :xs="24" :sm="12" :md="8">
          <el-form-item label="Название">
            <el-input
              v-model="form.title"
              placeholder="Название объекта"
              :maxlength="limits.property.title"
            />
          </el-form-item>
        </el-col>
        <el-col :span="12" :xs="24" :sm="12" :md="8">
          <el-form-item label="Регион">
            <el-autocomplete
              v-model="form.region"
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
        <el-col :span="12" :xs="24" :sm="12" :md="8">
          <el-form-item label="Город">
            <el-autocomplete
              v-model="form.city"
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
        <el-col :span="12" :xs="24" :sm="12" :md="8">
          <el-form-item label="Улица">
            <el-autocomplete
              v-model="form.street"
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
        <el-col :span="12" :xs="24" :sm="12" :md="8">
          <el-form-item label="№ участка">
            <el-input
              v-model="form.plotNumber"
              placeholder="1"
              :maxlength="limits.property.plotNumber"
            />
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

        <el-col :span="12" :xs="24" :sm="12" :md="8">
          <el-form-item label="Этажность">
            <el-input v-model.number="form.floors" type="number" />
          </el-form-item>
        </el-col>
        <el-col :span="12" :xs="24" :sm="12" :md="8">
          <el-form-item label="Комнат">
            <el-input v-model.number="form.rooms" type="number" />
          </el-form-item>
        </el-col>
        <el-col :span="12" :xs="24" :sm="12" :md="8">
          <el-form-item label="Стадия строительства">
            <el-select
              v-model="form.buildStage"
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
        <el-col :span="12" :xs="24" :sm="12" :md="8">
          <el-form-item label="Конструкция">
            <el-select
              v-model="form.constructionType"
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
        <el-col :span="12" :xs="24" :sm="12" :md="8">
          <el-form-item label="Отделка">
            <el-select
              v-model="form.finishingType"
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
        <el-col :span="12" :xs="24" :sm="12" :md="8">
          <el-form-item label="Тип договора">
            <el-select
              v-model="form.contractType"
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
        <el-col :span="12" :xs="24" :sm="12" :md="8">
          <el-form-item label="Готовность">
            <el-select
              v-model="form.readinessType"
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
        <el-col :span="12" :xs="24" :sm="12" :md="8">
          <el-form-item label="Регистрация">
            <el-select
              v-model="form.registration"
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
              v-model="form.description"
              type="textarea"
              :rows="3"
              placeholder="Описание объекта"
              :maxlength="limits.property.description"
            />
          </el-form-item>
        </el-col>

        <el-col :span="24">
          <el-form-item label="Фотографии (до 10 шт.)">
            <el-upload
              v-model:file-list="images"
              drag
              multiple
              :auto-upload="false"
              :limit="10"
              :disabled="saving"
              accept="image/jpeg,image/png,image/webp"
              :on-exceed="onImagesExceed"
              :on-change="onImagesChange"
            >
              <div class="muted">
                Перетащите файлы сюда или нажмите для выбора
              </div>
              <div class="muted" style="margin-top: 4px">
                JPG/PNG/WEBP, до 6 МБ
              </div>
            </el-upload>
          </el-form-item>
        </el-col>

        <el-col :span="24">
          <el-form-item label="Документы">
            <el-upload
              v-model:file-list="documents"
              drag
              multiple
              :auto-upload="false"
              :disabled="saving"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.jpg,.jpeg,.png"
            >
              <div class="muted">
                Перетащите файлы сюда или нажмите для выбора
              </div>
              <div class="muted" style="margin-top: 4px">PDF, DOCX, XLS</div>
            </el-upload>
          </el-form-item>
        </el-col>
      </el-row>
    </el-form>
  </el-card>
</template>
