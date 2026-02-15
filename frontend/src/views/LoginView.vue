<script setup>
import { ref, onMounted } from "vue";
import { useRouter, useRoute } from "vue-router";
import { useAuthStore } from "../stores/auth";
import { ElMessage } from "element-plus";
import { limits } from "@/utils/constraints";
import { LEGAL_DOC_VERSION } from "@/utils/consent";

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();

const activeTab = ref("login");
const loginForm = ref({ email: "", password: "" });
const registerForm = ref({
  lastName: "",
  firstName: "",
  middleName: "",
  phone: "",
  email: "",
  password: "",
  confirmPassword: "",
  role: "agent",
  companyName: "",
  agreeLegal: false,
  agreeMarketing: false,
});

const registerFormRef = ref(null);

const registerRules = {
  lastName: [{ required: true, message: "Введите фамилию", trigger: "blur" }],
  firstName: [{ required: true, message: "Введите имя", trigger: "blur" }],
  middleName: [
    { required: true, message: "Введите отчество", trigger: "blur" },
  ],
  email: [
    { required: true, message: "Введите email", trigger: "blur" },
    { type: "email", message: "Некорректный email", trigger: "blur" },
  ],
  phone: [{ required: true, message: "Введите телефон", trigger: "blur" }],
  password: [
    { required: true, message: "Введите пароль", trigger: "blur" },
    { min: 8, message: "Минимум 8 символов", trigger: "blur" },
    {
      pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      message: "Пароль должен содержать заглавные, строчные буквы и цифры",
      trigger: "blur",
    },
  ],
  confirmPassword: [
    { required: true, message: "Подтвердите пароль", trigger: "blur" },
    {
      validator: (rule, value, callback) => {
        if (value !== registerForm.value.password) {
          callback(new Error("Пароли не совпадают"));
        } else {
          callback();
        }
      },
      trigger: "blur",
    },
  ],
  agreeLegal: [
    {
      validator: (rule, value, callback) => {
        if (!value) {
          callback(new Error("Необходимо согласие"));
        } else {
          callback();
        }
      },
      trigger: "change",
    },
  ],
};

onMounted(() => {
  if (route.query.tab === "register") {
    activeTab.value = "register";
  }
});

function buildConsentPayload() {
  const acceptedAt = new Date().toISOString();
  return {
    legal: {
      accepted: Boolean(registerForm.value.agreeLegal),
      acceptedAt,
      documentVersion: LEGAL_DOC_VERSION,
      termsPath: "/terms",
      privacyPath: "/privacy",
    },
    marketing: {
      accepted: Boolean(registerForm.value.agreeMarketing),
      acceptedAt: registerForm.value.agreeMarketing ? acceptedAt : null,
      documentVersion: LEGAL_DOC_VERSION,
    },
  };
}

const submit = async () => {
  try {
    if (activeTab.value === "login") {
      const email = String(loginForm.value.email || "")
        .trim()
        .toLowerCase();
      const password = String(loginForm.value.password || "");
      await auth.login(email, password);
    } else {
      if (!registerFormRef.value) return;

      await registerFormRef.value.validate(async (valid) => {
        if (valid) {
          const email = String(registerForm.value.email || "")
            .trim()
            .toLowerCase();
          const phone = String(registerForm.value.phone || "").trim();

          await auth.register({
            lastName: registerForm.value.lastName,
            firstName: registerForm.value.firstName,
            middleName: registerForm.value.middleName,
            phone,
            email,
            password: registerForm.value.password,
            role: registerForm.value.role,
            companyName: registerForm.value.companyName,
            consent: buildConsentPayload(),
          });
        }
      });
    }
    if (!auth.error && activeTab.value === "login") {
      ElMessage.success("Успешный вход");
      router.push("/properties");
    } else if (!auth.error && activeTab.value === "register") {
      // Register calls login internally usually, so check store
      if (auth.user) {
        ElMessage.success("Регистрация успешна");
        router.push("/properties");
      }
    } else {
      if (auth.error) ElMessage.error(auth.error);
    }
  } catch (err) {
    // console.error(err);
    // ElMessage handled in store usually, but safeguard here
  }
};
</script>

<template>
  <div
    class="flex items-center justify-center min-h-full pt-12 pb-28 px-4 sm:py-12 sm:px-6 lg:px-8"
  >
    <div class="w-full max-w-md space-y-8" style="max-width: 600px">
      <el-card shadow="hover">
        <template #header>
          <h2 style="margin: 0; text-align: center">Добро пожаловать</h2>
        </template>
        <el-tabs v-model="activeTab" stretch>
          <el-tab-pane label="Вход" name="login">
            <el-form :model="loginForm" label-position="top">
              <el-form-item label="Email">
                <el-input
                  v-model="loginForm.email"
                  type="email"
                  placeholder="Введите email"
                  :maxlength="limits.auth.email"
                />
              </el-form-item>
              <el-form-item label="Пароль">
                <el-input
                  v-model="loginForm.password"
                  type="password"
                  placeholder="Введите пароль"
                  show-password
                  :maxlength="limits.auth.password"
                />
              </el-form-item>
              <el-form-item>
                <el-button
                  type="primary"
                  @click="submit"
                  :loading="auth.loading"
                  style="width: 100%"
                  >Войти</el-button
                >
              </el-form-item>
            </el-form>
          </el-tab-pane>
          <el-tab-pane label="Регистрация" name="register">
            <el-form
              ref="registerFormRef"
              :model="registerForm"
              :rules="registerRules"
              label-position="top"
            >
              <el-row :gutter="20">
                <el-col :xs="24" :sm="8">
                  <el-form-item label="Фамилия" prop="lastName">
                    <el-input
                      v-model="registerForm.lastName"
                      placeholder="Иванов"
                      :maxlength="limits.auth.lastName"
                    />
                  </el-form-item>
                </el-col>
                <el-col :xs="24" :sm="8">
                  <el-form-item label="Имя" prop="firstName">
                    <el-input
                      v-model="registerForm.firstName"
                      placeholder="Иван"
                      :maxlength="limits.auth.firstName"
                    />
                  </el-form-item>
                </el-col>
                <el-col :xs="24" :sm="8">
                  <el-form-item label="Отчество" prop="middleName">
                    <el-input
                      v-model="registerForm.middleName"
                      placeholder="Иванович"
                      :maxlength="limits.auth.middleName"
                    />
                  </el-form-item>
                </el-col>
              </el-row>
              <el-row :gutter="20">
                <el-col :xs="24" :sm="12">
                  <el-form-item label="Роль" prop="role">
                    <el-select
                      v-model="registerForm.role"
                      placeholder="Выберите роль"
                      style="width: 100%"
                    >
                      <el-option label="Агент" value="agent" />
                      <el-option label="Застройщик" value="developer" />
                    </el-select>
                  </el-form-item>
                </el-col>
                <el-col :xs="24" :sm="12">
                  <el-form-item label="Компания" prop="companyName">
                    <el-input
                      v-model="registerForm.companyName"
                      placeholder="Название компании"
                      :maxlength="limits.auth.companyName"
                    />
                  </el-form-item>
                </el-col>
              </el-row>
              <el-form-item label="Email" prop="email">
                <el-input
                  v-model="registerForm.email"
                  type="email"
                  placeholder="Введите email"
                  :maxlength="limits.auth.email"
                />
              </el-form-item>
              <el-form-item label="Телефон" prop="phone">
                <el-input
                  v-model="registerForm.phone"
                  placeholder="+7..."
                  :maxlength="limits.auth.phone"
                />
              </el-form-item>
              <el-form-item label="Пароль" prop="password">
                <el-input
                  v-model="registerForm.password"
                  type="password"
                  placeholder="Введите пароль"
                  show-password
                  :maxlength="limits.auth.password"
                />
              </el-form-item>
              <el-form-item label="Подтвердите пароль" prop="confirmPassword">
                <el-input
                  v-model="registerForm.confirmPassword"
                  type="password"
                  placeholder="Повторите пароль"
                  show-password
                  :maxlength="limits.auth.password"
                />
              </el-form-item>

              <el-form-item prop="agreeLegal" class="checkbox-item">
                <el-checkbox v-model="registerForm.agreeLegal">
                  <span class="checkbox-text">
                    Я принимаю условия
                    <a
                      href="/legal?tab=terms"
                      target="_blank"
                      class="text-blue-600 hover:underline"
                      >Пользовательского соглашения</a
                    >
                    и даю согласие на обработку моих персональных данных в
                    соответствии с
                    <a
                      href="/legal?tab=privacy"
                      target="_blank"
                      class="text-blue-600 hover:underline"
                      >Политикой конфиденциальности</a
                    >
                  </span>
                </el-checkbox>
              </el-form-item>

              <el-form-item class="checkbox-item">
                <el-checkbox v-model="registerForm.agreeMarketing">
                  <span class="checkbox-text">
                    Я даю согласие на получение информационных и рекламных
                    рассылок (новости сервиса, анонсы вебинаров).
                  </span>
                </el-checkbox>
                <div class="consent-hint">
                  Согласие на рассылку можно отозвать, обратившись в поддержку.
                </div>
              </el-form-item>

              <el-form-item>
                <el-button
                  type="primary"
                  @click="submit"
                  :loading="auth.loading"
                  style="width: 100%"
                  >Создать аккаунт</el-button
                >
              </el-form-item>
            </el-form>
          </el-tab-pane>
        </el-tabs>
      </el-card>
    </div>
  </div>
</template>

<style scoped>
:deep(.el-checkbox) {
  display: flex;
  align-items: flex-start;
  height: auto !important; /* Force auto height for wrapped text */
  padding: 4px 0; /* Add vertical padding */
}

:deep(.el-checkbox__input) {
  margin-top: 2px;
  flex-shrink: 0; /* Prevent checkbox squeeze */
}

:deep(.el-checkbox__label) {
  white-space: normal;
  word-break: break-word; /* Ensure long words don't overflow */
  line-height: 1.4;
  padding-left: 8px;
  display: inline-block; /* Helps with calculation */
}

.checkbox-item {
  margin-bottom: 24px; /* Increase gap between items */
}

.checkbox-text {
  display: block;
}

.consent-hint {
  margin-top: 6px;
  font-size: 12px;
  color: var(--text-muted, #737373);
}
</style>
