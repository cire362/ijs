<script setup>
import { ref } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "../stores/auth";
import { ElMessage } from "element-plus";
import { limits } from "@/utils/constraints";

const auth = useAuthStore();
const router = useRouter();

const activeTab = ref("login");
const loginForm = ref({ email: "agent@test.com", password: "password" });
const registerForm = ref({
  lastName: "",
  firstName: "",
  middleName: "",
  phone: "",
  email: "",
  password: "",
  role: "agent",
  companyName: "",
});

const submit = async () => {
  try {
    if (activeTab.value === "login") {
      const email = String(loginForm.value.email || "")
        .trim()
        .toLowerCase();
      const password = String(loginForm.value.password || "");
      await auth.login(email, password);
    } else {
      if (!String(registerForm.value.phone || "").trim()) {
        ElMessage.error("Укажите телефон");
        return;
      }

      const email = String(registerForm.value.email || "")
        .trim()
        .toLowerCase();
      const phone = String(registerForm.value.phone || "").trim();
      await auth.register({
        lastName: registerForm.value.lastName || "Иванов",
        firstName: registerForm.value.firstName || "Иван",
        middleName: registerForm.value.middleName || "Иванович",
        phone,
        email,
        password: registerForm.value.password,
        role: registerForm.value.role,
        companyName: registerForm.value.companyName,
      });
    }
    if (!auth.error) {
      ElMessage.success("Успешный вход");
      router.push("/properties");
    } else {
      ElMessage.error(auth.error);
    }
  } catch (err) {
    ElMessage.error(err.message || "Ошибка");
  }
};
</script>

<template>
  <div style="max-width: 600px; margin: 40px auto">
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
          <el-form :model="registerForm" label-position="top">
            <el-row :gutter="20">
              <el-col :span="8">
                <el-form-item label="Фамилия">
                  <el-input
                    v-model="registerForm.lastName"
                    placeholder="Иванов"
                    :maxlength="limits.auth.lastName"
                  />
                </el-form-item>
              </el-col>
              <el-col :span="8">
                <el-form-item label="Имя">
                  <el-input
                    v-model="registerForm.firstName"
                    placeholder="Иван"
                    :maxlength="limits.auth.firstName"
                  />
                </el-form-item>
              </el-col>
              <el-col :span="8">
                <el-form-item label="Отчество">
                  <el-input
                    v-model="registerForm.middleName"
                    placeholder="Иванович"
                    :maxlength="limits.auth.middleName"
                  />
                </el-form-item>
              </el-col>
            </el-row>
            <el-row :gutter="20">
              <el-col :span="12">
                <el-form-item label="Роль">
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
              <el-col :span="12">
                <el-form-item label="Компания">
                  <el-input
                    v-model="registerForm.companyName"
                    placeholder="Для застройщика"
                    :maxlength="limits.auth.companyName"
                  />
                </el-form-item>
              </el-col>
            </el-row>
            <el-form-item label="Email">
              <el-input
                v-model="registerForm.email"
                type="email"
                placeholder="Введите email"
                :maxlength="limits.auth.email"
              />
            </el-form-item>
            <el-form-item label="Телефон">
              <el-input
                v-model="registerForm.phone"
                placeholder="+7..."
                :maxlength="limits.auth.phone"
              />
            </el-form-item>
            <el-form-item label="Телефон">
              <el-input v-model="registerForm.phone" placeholder="+7..." />
            </el-form-item>
            <el-form-item label="Пароль">
              <el-input
                v-model="registerForm.password"
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
                >Создать аккаунт</el-button
              >
            </el-form-item>
          </el-form>
        </el-tab-pane>
      </el-tabs>
    </el-card>
  </div>
</template>
