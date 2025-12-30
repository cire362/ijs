<script setup>
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore, apiClient } from "../stores/auth";
import { ElMessage } from "element-plus";
import SearchCard from "@/components/ui/SearchCard.vue";
import { normalizeText } from "@/utils/text";
import { formatDate } from "@/utils/datetime";
import { limits } from "@/utils/constraints";

const auth = useAuthStore();
const router = useRouter();

const items = ref([]);
const loading = ref(false);

const isAdmin = computed(() => auth.user?.role === "admin");

const q = ref("");

const form = ref({
  title: "",
  subtitle: "",
  excerpt: "",
  content: "",
  isPublished: true,
});

const createImages = ref([]);

function onImagesExceed() {
  ElMessage.warning("Можно загрузить до 10 изображений");
}

function onImagesChange(file, fileList) {
  const raw = file?.raw;
  if (!raw) return;

  const okType = ["image/jpeg", "image/png", "image/webp"].includes(raw.type);
  if (!okType) {
    ElMessage.error("Допустимы только JPG/PNG/WEBP");
    createImages.value = (fileList || []).filter((f) => f.uid !== file.uid);
    return;
  }

  const maxSize = 6 * 1024 * 1024;
  if (raw.size > maxSize) {
    ElMessage.error("Файл слишком большой (макс 6 МБ)");
    createImages.value = (fileList || []).filter((f) => f.uid !== file.uid);
    return;
  }

  createImages.value = fileList || [];
}

const creating = ref(false);

const filtered = computed(() => {
  const qq = normalizeText(q.value);
  if (!qq) return items.value;
  return items.value.filter((n) => {
    const hay = [n.title, n.subtitle, n.excerpt, n.content]
      .filter(Boolean)
      .map((x) => normalizeText(x))
      .join(" ");
    return hay.includes(qq);
  });
});

function openNews(n) {
  router.push(`/news/${n.id}`);
}

async function load() {
  loading.value = true;
  try {
    const { data } = await apiClient.get("/news");
    items.value = Array.isArray(data) ? data : [];
  } catch (err) {
    ElMessage.error(
      err.response?.data?.error || "Не удалось загрузить новости"
    );
  } finally {
    loading.value = false;
  }
}

async function createNews() {
  if (!form.value.title.trim() || !form.value.content.trim()) {
    ElMessage.error("Заполните заголовок и текст");
    return;
  }

  creating.value = true;
  try {
    const payload = {
      title: form.value.title,
      subtitle: form.value.subtitle,
      excerpt: form.value.excerpt,
      content: form.value.content,
      isPublished: form.value.isPublished,
    };
    const { data: created } = await apiClient.post("/news", payload);

    if (Array.isArray(createImages.value) && createImages.value.length) {
      const fd = new FormData();
      for (const f of createImages.value) {
        if (f?.raw) fd.append("images", f.raw);
      }
      if ([...fd.keys()].length) {
        try {
          await apiClient.post(`/news/${created.id}/images`, fd, {
            headers: { "Content-Type": "multipart/form-data" },
          });
          ElMessage.success("Новость создана и изображения загружены");
        } catch (err) {
          ElMessage.error(
            err.response?.data?.error ||
              "Новость создана, но не удалось загрузить изображения"
          );
        }
      }
    } else {
      ElMessage.success("Новость создана");
    }

    form.value = {
      title: "",
      subtitle: "",
      excerpt: "",
      content: "",
      isPublished: true,
    };

    createImages.value = [];
    await load();
  } catch (err) {
    ElMessage.error(err.response?.data?.error || "Не удалось создать новость");
  } finally {
    creating.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div>
    <div class="section-head">
      <div>
        <div class="pill">Новости</div>
        <h2 style="margin: 4px 0">Новости</h2>
        <div class="muted">Актуальные обновления и объявления</div>
      </div>
      <el-button @click="load" :loading="loading" type="default"
        >Обновить</el-button
      >
    </div>

    <el-card v-if="isAdmin" shadow="never" style="margin-bottom: var(--gap-md)">
      <div class="muted" style="margin-bottom: 8px">Создать новость</div>

      <el-form label-position="top">
        <el-form-item label="Заголовок">
          <el-input
            v-model="form.title"
            placeholder="Введите заголовок"
            :maxlength="limits.news.title"
          />
        </el-form-item>

        <el-form-item label="Подзаголовок (опционально)">
          <el-input
            v-model="form.subtitle"
            placeholder="Короткий подзаголовок"
            :maxlength="limits.news.subtitle"
          />
        </el-form-item>

        <el-form-item label="Краткое описание (опционально)">
          <el-input
            v-model="form.excerpt"
            type="textarea"
            :rows="2"
            placeholder="Краткий текст для карточки"
            :maxlength="limits.news.excerpt"
          />
        </el-form-item>

        <el-form-item label="Текст новости">
          <el-input
            v-model="form.content"
            type="textarea"
            :rows="6"
            placeholder="Подробный текст новости"
            :maxlength="limits.news.content"
          />
        </el-form-item>

        <el-form-item label="Картинки (до 10 шт.)">
          <el-upload
            v-model:file-list="createImages"
            drag
            multiple
            :auto-upload="false"
            :limit="10"
            :disabled="creating"
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

        <div
          style="
            display: flex;
            gap: var(--gap-sm);
            align-items: center;
            flex-wrap: wrap;
          "
        >
          <el-switch
            v-model="form.isPublished"
            active-text="Опубликована"
            inactive-text="Черновик"
          />
          <el-button type="primary" :loading="creating" @click="createNews">
            Создать
          </el-button>
        </div>

        <div class="muted" style="margin-top: 8px">
          Вы можете сразу прикрепить картинки при создании или добавить их на
          странице новости.
        </div>
      </el-form>
    </el-card>

    <SearchCard
      v-model:q="q"
      label="Поиск"
      placeholder="Поиск по заголовку/тексту"
      :count="filtered.length"
    />

    <div v-loading="loading" style="display: grid; gap: var(--gap-md)">
      <el-empty v-if="!filtered.length" description="Новостей пока нет" />

      <el-card
        v-for="n in filtered"
        :key="n.id"
        shadow="hover"
        style="cursor: pointer"
        @click="openNews(n)"
      >
        <img
          v-if="Array.isArray(n.images) && n.images.length && n.images[0]?.url"
          :src="n.images[0].url"
          :alt="n.images[0].caption || 'news cover'"
          style="
            width: 100%;
            max-height: 220px;
            object-fit: cover;
            border-radius: var(--radius);
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
              {{ n.title }}
            </div>
            <div v-if="n.subtitle" class="muted" style="margin-top: 4px">
              {{ n.subtitle }}
            </div>
            <div v-if="n.excerpt" style="margin-top: 8px">
              {{ n.excerpt }}
            </div>
            <div v-else class="muted" style="margin-top: 8px">
              {{ String(n.content || "").slice(0, 140)
              }}<span v-if="String(n.content || '').length > 140">…</span>
            </div>
          </div>

          <div style="text-align: right">
            <div class="muted">
              {{ formatDate(n.publishedAt || n.createdAt) }}
            </div>
            <el-tag
              v-if="isAdmin"
              :type="n.isPublished ? 'success' : 'info'"
              effect="light"
              style="margin-top: 6px"
            >
              {{ n.isPublished ? "Опубликована" : "Черновик" }}
            </el-tag>
          </div>
        </div>
      </el-card>
    </div>
  </div>
</template>
