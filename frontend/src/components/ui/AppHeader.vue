<template>
  <el-header class="app-header">
    <div class="header-inner">
      <div class="brand">
        <div class="brand-mark">NM</div>
        <div>
          <div class="brand-title">ИЖС Hub</div>
          <div class="brand-sub">B2B маркетплейс</div>
        </div>
      </div>
      <el-menu
        mode="horizontal"
        :default-active="active"
        router
        class="menu"
        :ellipsis="false"
      >
        <el-menu-item index="/properties">Поиск</el-menu-item>
        <el-menu-item v-if="isAgent" index="/applications"
          >Мои заявки</el-menu-item
        >
        <el-menu-item v-if="isManager" index="/incoming">Входящие</el-menu-item>
        <el-menu-item v-if="isAuthed" index="/notifications"
          >Уведомления</el-menu-item
        >
      </el-menu>
      <div class="header-actions">
        <el-button v-if="!auth.user" type="warning" @click="goLogin"
          >Войти</el-button
        >
        <el-dropdown v-else trigger="click">
          <span class="profile" role="button">
            <el-avatar :size="36" :src="avatarSrc">
              {{ initials }}
            </el-avatar>
            <div class="profile-info">
              <span class="name">{{ displayName }}</span>
              <span class="role">{{ auth.user.role }}</span>
            </div>
            <el-icon><ArrowDown /></el-icon>
          </span>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item disabled>
                <el-tag size="small" type="info">{{ auth.user.role }}</el-tag>
              </el-dropdown-item>
              <el-dropdown-item @click="goProfile"
                >Личный кабинет</el-dropdown-item
              >
              <el-dropdown-item @click="auth.logout()">Выйти</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </div>
  </el-header>
</template>

<script setup>
import { computed } from "vue";
import { useRouter, useRoute } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { ArrowDown } from "@element-plus/icons-vue";

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();

const active = computed(() => route.path);
const isAuthed = computed(() => !!auth.user);
const isAgent = computed(() => auth.user?.role === "agent");
const isManager = computed(
  () =>
    (auth.user?.role === "developer" && auth.user?.developerApproved) ||
    auth.user?.role === "admin"
);

const avatarSrc = computed(() => auth.user?.avatarUrl || "");
const displayName = computed(() => {
  const u = auth.user;
  if (!u) return "";
  return (
    u.fullName ||
    [u.lastName, u.firstName, u.middleName].filter(Boolean).join(" ") ||
    u.name ||
    "Пользователь"
  );
});

const initials = computed(() => {
  const u = auth.user;
  if (!u) return "U";
  const s = (u.firstName || displayName.value || "U").trim();
  return s ? s[0].toUpperCase() : "U";
});

function goLogin() {
  router.push("/login");
}

function goProfile() {
  router.push("/profile");
}
</script>

<style scoped>
.app-header {
  background: var(--header-bg);
  color: #fff;
  padding: 0 var(--gap-lg);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
}
.header-inner {
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--gap-md);
}
.brand {
  display: flex;
  align-items: center;
  gap: var(--gap-sm);
}
.brand-mark {
  width: 42px;
  height: 42px;
  border-radius: 10px;
  background: var(--accent-yellow);
  color: var(--header-bg);
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  letter-spacing: -0.5px;
}
.brand-title {
  font-weight: 700;
  letter-spacing: -0.2px;
}
.brand-sub {
  color: #e0e0e0;
  font-size: 12px;
}
.menu {
  background: transparent;
  flex: 1;
  justify-content: center;
}
:deep(.el-menu--horizontal > .el-menu-item) {
  color: #fff;
}
:deep(.el-menu--horizontal > .el-menu-item.is-active) {
  border-bottom-color: var(--accent-yellow);
}
.header-actions {
  display: flex;
  align-items: center;
  gap: var(--gap-sm);
}
.profile {
  display: flex;
  align-items: center;
  gap: var(--gap-xs);
  color: #fff;
}
.profile-info {
  display: flex;
  flex-direction: column;
  line-height: 1.2;
}
.name {
  font-weight: 600;
}
.role {
  color: #e0e0e0;
  font-size: 12px;
  text-transform: uppercase;
}
</style>
