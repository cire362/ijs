<script setup>
import { ElMessage } from "element-plus";

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
      </el-row>
    </el-form>
  </el-card>
</template>
