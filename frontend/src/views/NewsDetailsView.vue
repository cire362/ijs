<script setup>
import { computed, onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import { useAuthStore, apiClient } from "../stores/auth";
import { ElMessage } from "element-plus";
import { formatDateTime } from "@/utils/datetime";

const route = useRoute();
const auth = useAuthStore();

const isAdmin = computed(() => auth.user?.role === "admin");

const item = ref(null);
const loading = ref(false);

const edit = ref({
  title: "",
  subtitle: "",
  excerpt: "",
  content: "",
  isPublished: true,
});

const saving = ref(false);

const selectedFiles = ref([]);
const uploading = ref(false);

const headerImage = computed(() => {
  const imgs = item.value?.images;
  return Array.isArray(imgs) && imgs.length ? imgs[0] : null;
});

const sliderImages = computed(() => {
  const imgs = item.value?.images;
  return Array.isArray(imgs) && imgs.length > 1 ? imgs.slice(1) : [];
});

// formatDateTime вынесен в utils

async function load() {
  loading.value = true;
  try {
    const { data } = await apiClient.get(`/news/${route.params.id}`);
    item.value = data;
    edit.value = {
      title: data?.title || "",
      subtitle: data?.subtitle || "",
      excerpt: data?.excerpt || "",
      content: data?.content || "",
      isPublished: !!data?.isPublished,
    };
  } catch (err) {
    ElMessage.error(
      err.response?.data?.error || "Не удалось загрузить новость"
    );
  } finally {
    loading.value = false;
  }
}

async function save() {
  if (!isAdmin.value) return;
  if (!edit.value.title.trim() || !edit.value.content.trim()) {
    ElMessage.error("Заголовок и текст обязательны");
    return;
  }

  saving.value = true;
  try {
    const payload = {
      title: edit.value.title,
      subtitle: edit.value.subtitle,
      excerpt: edit.value.excerpt,
      content: edit.value.content,
      isPublished: edit.value.isPublished,
    };
    const { data } = await apiClient.patch(`/news/${route.params.id}`, payload);
    item.value = data;
    ElMessage.success("Сохранено");
  } catch (err) {
    ElMessage.error(err.response?.data?.error || "Не удалось сохранить");
  } finally {
    saving.value = false;
  }
}

function onFileChange(e) {
  const files = Array.from(e.target.files || []);
  selectedFiles.value = files;
}

async function uploadImages() {
  if (!isAdmin.value) return;
  if (!selectedFiles.value.length) {
    ElMessage.error("Выберите файлы");
    return;
  }

  uploading.value = true;
  try {
    const fd = new FormData();
    selectedFiles.value.forEach((f) => fd.append("images", f));

    const { data } = await apiClient.post(
      `/news/${route.params.id}/images`,
      fd,
      {
        headers: { "Content-Type": "multipart/form-data" },
      }
    );

    item.value = data;
    selectedFiles.value = [];
    ElMessage.success("Картинки загружены");
  } catch (err) {
    ElMessage.error(
      err.response?.data?.error || "Не удалось загрузить картинки"
    );
  } finally {
    uploading.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div>
    <div class="section-head">
      <div>
        <div class="pill">Новости</div>
        <h2 style="margin: 4px 0">{{ item?.title || "Новость" }}</h2>
        <div class="muted">
          {{
            item?.publishedAt
              ? formatDateTime(item.publishedAt)
              : formatDateTime(item?.createdAt)
          }}
          <template v-if="isAdmin">
            ·
            <el-tag
              :type="item?.isPublished ? 'success' : 'info'"
              effect="light"
            >
              {{ item?.isPublished ? "Опубликована" : "Черновик" }}
            </el-tag>
          </template>
        </div>
      </div>
      <el-button @click="load" :loading="loading" type="default"
        >Обновить</el-button
      >
    </div>

    <el-skeleton v-if="loading" :rows="8" animated />

    <template v-else-if="item">
      <el-card shadow="never">
        <img
          v-if="headerImage"
          :src="headerImage.url"
          :alt="headerImage.caption || 'news cover'"
          style="
            width: 100%;
            max-height: 360px;
            object-fit: cover;
            border-radius: var(--radius);
          "
        />

        <div v-if="item.subtitle" style="margin-top: 12px; font-weight: 700">
          {{ item.subtitle }}
        </div>

        <div style="margin-top: 12px; white-space: pre-wrap">
          {{ item.content }}
        </div>

        <div v-if="sliderImages.length" style="margin-top: 16px">
          <div class="muted" style="margin-bottom: 8px">Галерея</div>
          <el-carousel height="260px" indicator-position="outside">
            <el-carousel-item v-for="img in sliderImages" :key="img.id">
              <img
                :src="img.url"
                :alt="img.caption || 'news image'"
                style="
                  width: 100%;
                  height: 260px;
                  object-fit: cover;
                  border-radius: var(--radius);
                "
              />
            </el-carousel-item>
          </el-carousel>
        </div>
      </el-card>

      <el-card v-if="isAdmin" shadow="never" style="margin-top: var(--gap-md)">
        <div class="muted" style="margin-bottom: 8px">Редактирование</div>
        <el-form label-position="top">
          <el-form-item label="Заголовок">
            <el-input v-model="edit.title" />
          </el-form-item>
          <el-form-item label="Подзаголовок">
            <el-input v-model="edit.subtitle" />
          </el-form-item>
          <el-form-item label="Краткое описание">
            <el-input v-model="edit.excerpt" type="textarea" :rows="2" />
          </el-form-item>
          <el-form-item label="Текст">
            <el-input v-model="edit.content" type="textarea" :rows="8" />
          </el-form-item>

          <div
            style="
              display: flex;
              gap: var(--gap-sm);
              align-items: center;
              flex-wrap: wrap;
            "
          >
            <el-switch
              v-model="edit.isPublished"
              active-text="Опубликована"
              inactive-text="Черновик"
            />
            <el-button type="primary" :loading="saving" @click="save"
              >Сохранить</el-button
            >
          </div>
        </el-form>

        <el-divider style="margin: 16px 0" />
        <div class="muted" style="margin-bottom: 8px">Загрузка картинок</div>
        <div
          style="
            display: flex;
            gap: var(--gap-sm);
            align-items: center;
            flex-wrap: wrap;
          "
        >
          <input type="file" multiple accept="image/*" @change="onFileChange" />
          <el-button type="primary" :loading="uploading" @click="uploadImages">
            Загрузить
          </el-button>
        </div>
        <div class="muted" style="margin-top: 8px">
          Можно загрузить до 10 картинок за раз.
        </div>
      </el-card>
    </template>

    <el-empty v-else description="Новость не найдена" />
  </div>
</template>
