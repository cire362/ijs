<script setup>
import { computed, onMounted, ref } from "vue";
import { ElMessage } from "element-plus";
import { apiClient, useAuthStore } from "../stores/auth";

const auth = useAuthStore();

const loading = ref(false);
const saving = ref(false);

const form = ref({
  lastName: "",
  firstName: "",
  middleName: "",
  email: "",
  phone: "",
  companyName: "",
});

const isAuthed = computed(() => Boolean(auth.user));

onMounted(() => {
  if (isAuthed.value) load();
});

async function load() {
  loading.value = true;
  try {
    const { data } = await apiClient.get("/users/me");
    form.value = {
      lastName: data.lastName || "",
      firstName: data.firstName || "",
      middleName: data.middleName || "",
      email: data.email || "",
      phone: data.phone || "",
      companyName: data.companyName || "",
    };

    if (auth.user) {
      auth.user = { ...auth.user, ...data };
      auth.persist();
    }
  } catch (err) {
    ElMessage.error(
      err.response?.data?.error || "Не удалось загрузить профиль"
    );
  } finally {
    loading.value = false;
  }
}

const avatarSrc = computed(() => auth.user?.avatarUrl || "");
const displayName = computed(
  () => auth.user?.fullName || auth.user?.name || "Пользователь"
);

async function uploadAvatar(options) {
  const file = options?.file;
  if (!file) {
    ElMessage.error("Файл не выбран");
    return;
  }

  if (!file.type?.startsWith("image/")) {
    ElMessage.error("Можно загрузить только изображение");
    return;
  }

  const maxBytes = 2 * 1024 * 1024;
  if (file.size > maxBytes) {
    ElMessage.error("Максимальный размер файла — 2 МБ");
    return;
  }

  const fd = new FormData();
  fd.append("avatar", file);

  try {
    const { data } = await apiClient.post("/users/me/avatar", fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });

    if (auth.user) {
      auth.user = { ...auth.user, ...data };
      auth.persist();
    }

    ElMessage.success("Аватар обновлён");
  } catch (err) {
    ElMessage.error(err.response?.data?.error || "Не удалось загрузить аватар");
  } finally {
    options?.onSuccess?.();
  }
}

async function save() {
  saving.value = true;
  try {
    const { data } = await apiClient.patch("/users/me", {
      firstName: form.value.firstName,
      lastName: form.value.lastName,
      middleName: form.value.middleName,
      email: form.value.email,
      phone: form.value.phone,
      companyName: form.value.companyName,
    });

    // Update header name immediately
    if (auth.user) {
      auth.user = { ...auth.user, ...data };
      auth.persist();
    }

    ElMessage.success("Профиль обновлён");
  } catch (err) {
    ElMessage.error(
      err.response?.data?.error || "Не удалось сохранить профиль"
    );
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div>
    <div class="section-head">
      <div>
        <div class="pill">Аккаунт</div>
        <h2 style="margin: 4px 0">Личный кабинет</h2>
        <div class="muted">Контактные данные и реквизиты компании.</div>
      </div>
      <el-button
        type="primary"
        :loading="saving"
        :disabled="!isAuthed"
        @click="save"
        >Сохранить</el-button
      >
    </div>

    <el-empty
      v-if="!isAuthed"
      description="Авторизуйтесь, чтобы редактировать профиль"
    />

    <el-card v-else shadow="never" v-loading="loading">
      <el-form :model="form" label-position="top">
        <el-row :gutter="12" style="margin-bottom: 8px">
          <el-col :span="24">
            <el-form-item label="Аватар">
              <div
                style="
                  display: flex;
                  align-items: center;
                  gap: 12px;
                  flex-wrap: wrap;
                "
              >
                <el-avatar :size="56" :src="avatarSrc">
                  {{ displayName?.[0] || "U" }}
                </el-avatar>
                <el-upload
                  :show-file-list="false"
                  accept="image/*"
                  :http-request="uploadAvatar"
                >
                  <el-button type="default">Загрузить аватар</el-button>
                </el-upload>
                <div class="muted">PNG/JPG/WebP, до 2 МБ</div>
              </div>
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="12">
          <el-col :span="12" :xs="24">
            <el-form-item label="Фамилия">
              <el-input v-model="form.lastName" placeholder="Иванов" />
            </el-form-item>
          </el-col>
          <el-col :span="12" :xs="24">
            <el-form-item label="Имя">
              <el-input v-model="form.firstName" placeholder="Иван" />
            </el-form-item>
          </el-col>
          <el-col :span="12" :xs="24">
            <el-form-item label="Отчество">
              <el-input v-model="form.middleName" placeholder="Иванович" />
            </el-form-item>
          </el-col>
          <el-col :span="12" :xs="24">
            <el-form-item label="Email">
              <el-input
                v-model="form.email"
                type="email"
                placeholder="you@company.ru"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12" :xs="24">
            <el-form-item label="Телефон">
              <el-input v-model="form.phone" placeholder="+7..." />
            </el-form-item>
          </el-col>
          <el-col :span="12" :xs="24">
            <el-form-item label="Компания">
              <el-input
                v-model="form.companyName"
                placeholder="Название компании"
              />
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
    </el-card>
  </div>
</template>
