<script setup>
import { computed, onMounted, ref } from "vue";
import { ElMessage } from "element-plus";
import { apiClient, useAuthStore } from "../stores/auth";
import { limits } from "@/utils/constraints";
import { LEGAL_DOC_VERSION } from "@/utils/consent";

const auth = useAuthStore();

const loading = ref(false);
const saving = ref(false);

const passwordSaving = ref(false);
const consentSaving = ref(false);
const passwordForm = ref({
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
});

const form = ref({
  lastName: "",
  firstName: "",
  middleName: "",
  email: "",
  phone: "",
  companyName: "",
});

const isAuthed = computed(() => Boolean(auth.user));
const marketingConsentGiven = computed(() =>
  Boolean(auth.user?.marketingConsentGiven),
);

const marketingConsentText = computed(() => {
  if (marketingConsentGiven.value) {
    const at = auth.user?.marketingConsentAcceptedAt;
    return at
      ? `Согласие активно с ${new Date(at).toLocaleString("ru-RU")}`
      : "Согласие активно";
  }

  const withdrawnAt = auth.user?.marketingConsentWithdrawnAt;
  if (withdrawnAt) {
    return `Согласие отозвано ${new Date(withdrawnAt).toLocaleString("ru-RU")}`;
  }

  return "Согласие не предоставлено";
});

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
    }
  } catch (err) {
    ElMessage.error(
      err.response?.data?.error || "Не удалось загрузить профиль",
    );
  } finally {
    loading.value = false;
  }
}

const avatarSrc = computed(() => auth.user?.avatarUrl || "");
const displayName = computed(
  () => auth.user?.fullName || auth.user?.name || "Пользователь",
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
    const payload = {
      firstName: String(form.value.firstName || "").trim(),
      lastName: String(form.value.lastName || "").trim(),
      middleName: String(form.value.middleName || "").trim(),
      email: String(form.value.email || "")
        .trim()
        .toLowerCase(),
      phone: String(form.value.phone || "").trim(),
      companyName: String(form.value.companyName || "").trim(),
    };

    const { data } = await apiClient.patch("/users/me", {
      ...payload,
    });

    // Update header name immediately
    if (auth.user) {
      auth.user = { ...auth.user, ...data };
    }

    ElMessage.success("Профиль обновлён");
  } catch (err) {
    ElMessage.error(
      err.response?.data?.error || "Не удалось сохранить профиль",
    );
  } finally {
    saving.value = false;
  }
}

async function changePassword() {
  if (!passwordForm.value.currentPassword || !passwordForm.value.newPassword) {
    ElMessage.error("Укажите текущий и новый пароль");
    return;
  }
  if (passwordForm.value.newPassword.length < 8) {
    ElMessage.error("Пароль должен быть минимум 8 символов");
    return;
  }
  if (passwordForm.value.newPassword !== passwordForm.value.confirmPassword) {
    ElMessage.error("Пароли не совпадают");
    return;
  }

  passwordSaving.value = true;
  try {
    await apiClient.patch("/users/me/password", {
      currentPassword: passwordForm.value.currentPassword,
      newPassword: passwordForm.value.newPassword,
    });
    passwordForm.value = {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    };
    ElMessage.success("Пароль обновлён");
  } catch (err) {
    ElMessage.error(err.response?.data?.error || "Не удалось сменить пароль");
  } finally {
    passwordSaving.value = false;
  }
}

async function setMarketingConsent(accepted) {
  consentSaving.value = true;
  try {
    const { data } = await apiClient.patch("/users/me/consents/marketing", {
      accepted,
      documentVersion: LEGAL_DOC_VERSION,
    });

    if (auth.user) {
      auth.user = { ...auth.user, ...data };
    }

    ElMessage.success(
      accepted
        ? "Маркетинговое согласие включено"
        : "Маркетинговое согласие отозвано",
    );
  } catch (err) {
    ElMessage.error(
      err.response?.data?.error || "Не удалось обновить маркетинговое согласие",
    );
  } finally {
    consentSaving.value = false;
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

    <el-card
      v-else
      shadow="never"
      v-loading="loading"
      style="margin-bottom: var(--gap-md)"
    >
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
              <el-input
                v-model="form.lastName"
                placeholder="Иванов"
                :maxlength="limits.user.lastName"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12" :xs="24">
            <el-form-item label="Имя">
              <el-input
                v-model="form.firstName"
                placeholder="Иван"
                :maxlength="limits.user.firstName"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12" :xs="24">
            <el-form-item label="Отчество">
              <el-input
                v-model="form.middleName"
                placeholder="Иванович"
                :maxlength="limits.user.middleName"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12" :xs="24">
            <el-form-item label="Email">
              <el-input
                v-model="form.email"
                type="email"
                placeholder="you@company.ru"
                :maxlength="limits.user.email"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12" :xs="24">
            <el-form-item label="Телефон">
              <el-input
                v-model="form.phone"
                placeholder="+7..."
                :maxlength="limits.user.phone"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12" :xs="24">
            <el-form-item label="Компания">
              <el-input
                v-model="form.companyName"
                placeholder="Название компании"
                :maxlength="limits.user.companyName"
              />
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
    </el-card>

    <el-card v-if="isAuthed" shadow="never">
      <template #header>
        <div class="section-head" style="margin: 0">
          <div>
            <div class="pill">Безопасность</div>
            <div style="font-weight: 700">Смена пароля</div>
          </div>
          <el-button
            type="primary"
            :loading="passwordSaving"
            @click="changePassword"
            >Сменить пароль</el-button
          >
        </div>
      </template>

      <el-form :model="passwordForm" label-position="top">
        <el-row :gutter="12">
          <el-col :span="12" :xs="24">
            <el-form-item label="Текущий пароль">
              <el-input
                v-model="passwordForm.currentPassword"
                type="password"
                show-password
              />
            </el-form-item>
          </el-col>
          <el-col :span="12" :xs="24">
            <el-form-item label="Новый пароль">
              <el-input
                v-model="passwordForm.newPassword"
                type="password"
                show-password
              />
            </el-form-item>
          </el-col>
          <el-col :span="12" :xs="24">
            <el-form-item label="Повторите новый пароль">
              <el-input
                v-model="passwordForm.confirmPassword"
                type="password"
                show-password
              />
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
    </el-card>

    <el-card v-if="isAuthed" shadow="never" style="margin-top: var(--gap-md)">
      <template #header>
        <div class="section-head" style="margin: 0">
          <div>
            <div class="pill">Согласия</div>
            <div style="font-weight: 700">Маркетинговые коммуникации</div>
          </div>
          <div style="display: flex; gap: 8px; flex-wrap: wrap">
            <el-button
              type="default"
              :loading="consentSaving"
              :disabled="marketingConsentGiven"
              @click="setMarketingConsent(true)"
            >
              Дать согласие
            </el-button>
            <el-button
              type="warning"
              plain
              :loading="consentSaving"
              :disabled="!marketingConsentGiven"
              @click="setMarketingConsent(false)"
            >
              Отозвать согласие
            </el-button>
          </div>
        </div>
      </template>

      <div class="muted" style="margin-bottom: 10px">
        {{ marketingConsentText }}
      </div>
      <div class="muted">
        Вы можете в любой момент изменить решение по рекламно-информационным
        рассылкам без влияния на использование сервиса.
      </div>
    </el-card>
  </div>
</template>
