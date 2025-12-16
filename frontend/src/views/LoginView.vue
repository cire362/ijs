<script setup>
import { ref } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "../stores/auth";
import { ElMessage } from "element-plus";

const auth = useAuthStore();
const router = useRouter();

const activeTab = ref("login");
const loginForm = ref({ email: "agent@test.com", password: "password" });
const registerForm = ref({
  lastName: "",
  firstName: "",
  middleName: "",
  email: "",
  password: "",
  role: "agent",
  companyName: "",
});

const submit = async () => {
  try {
    if (activeTab.value === "login") {
      await auth.login(loginForm.value.email, loginForm.value.password);
    } else {
      await auth.register({
        lastName: registerForm.value.lastName || "Иванов",
        firstName: registerForm.value.firstName || "Иван",
        middleName: registerForm.value.middleName || "Иванович",
        email: registerForm.value.email,
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
              />
            </el-form-item>
            <el-form-item label="Пароль">
              <el-input
                v-model="loginForm.password"
                type="password"
                placeholder="Введите пароль"
                show-password
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
                  />
                </el-form-item>
              </el-col>
              <el-col :span="8">
                <el-form-item label="Имя">
                  <el-input
                    v-model="registerForm.firstName"
                    placeholder="Иван"
                  />
                </el-form-item>
              </el-col>
              <el-col :span="8">
                <el-form-item label="Отчество">
                  <el-input
                    v-model="registerForm.middleName"
                    placeholder="Иванович"
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
                    <el-option label="Админ" value="admin" />
                  </el-select>
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="Компания">
                  <el-input
                    v-model="registerForm.companyName"
                    placeholder="Для застройщика"
                  />
                </el-form-item>
              </el-col>
            </el-row>
            <el-form-item label="Email">
              <el-input
                v-model="registerForm.email"
                type="email"
                placeholder="Введите email"
              />
            </el-form-item>
            <el-form-item label="Пароль">
              <el-input
                v-model="registerForm.password"
                type="password"
                placeholder="Введите пароль"
                show-password
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
