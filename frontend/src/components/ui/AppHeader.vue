<template>
  <el-header class="app-header">
    <div class="header-inner">
      <div class="brand" @click="router.push('/')" style="cursor: pointer">
        <div class="brand-mark">ИЖС</div>
        <div class="brand-text">
          <div class="brand-title">ИЖС</div>
          <div class="brand-sub">ИЖС</div>
        </div>
      </div>
      <div class="desktop-menu">
        <el-menu
          mode="horizontal"
          :default-active="active"
          router
          class="menu"
          :ellipsis="false"
        >
          <el-menu-item v-if="!isAuthed" index="/">Главная</el-menu-item>
          <el-menu-item v-if="isAuthed" index="/properties">
            {{ isDeveloper ? "Мои объекты" : "Поиск" }}
          </el-menu-item>
          <el-menu-item index="/news">Новости</el-menu-item>
          <el-menu-item index="/events">Мероприятия</el-menu-item>
          <el-menu-item v-if="isAgent" index="/applications"
            >Мои заявки</el-menu-item
          >
          <el-menu-item v-if="isAgent || isAdmin" index="/application-chats">
            <el-badge
              v-if="appChats.unreadBadge"
              :value="appChats.unreadBadge"
              type="danger"
              :offset="[0, 10]"
            >
              <span>Чаты заявок</span>
            </el-badge>
            <span v-else>Чаты заявок</span>
          </el-menu-item>
          <el-menu-item v-if="isManager" index="/incoming"
            >Входящие</el-menu-item
          >
          <el-menu-item v-if="isAdmin" index="/admin/chat">
            <el-badge
              v-if="supportStore.adminUnreadCount > 0"
              :value="supportStore.adminUnreadCount"
              type="danger"
              :offset="[0, 10]"
            >
              Чат поддержки
            </el-badge>
            <span v-else>Чат поддержки</span>
          </el-menu-item>
          <el-menu-item v-if="isAuthed" index="/notifications">
            <el-badge
              v-if="notifications.unreadBadge"
              :value="notifications.unreadBadge"
              type="danger"
              :offset="[0, 10]"
            >
              <span>Уведомления</span>
            </el-badge>
            <span v-else>Уведомления</span>
          </el-menu-item>
        </el-menu>
      </div>

      <div class="header-actions">
        <div class="mobile-toggle" @click="toggleMobileMenu">
          <el-icon :size="24"><MenuIcon /></el-icon>
        </div>
        <el-button
          class="desktop-only-btn"
          v-if="!auth.user"
          type="warning"
          @click="goLogin"
          >Войти</el-button
        >
        <el-dropdown v-else trigger="click">
          <span class="profile" role="button">
            <el-avatar class="profile-avatar" :size="36" :src="avatarSrc">
              {{ initials }}
            </el-avatar>
            <div class="profile-info">
              <span class="name">{{ displayName }}</span>
              <span class="role">{{ roleLabel }}</span>
            </div>
            <el-icon class="profile-caret"><ArrowDown /></el-icon>
          </span>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item disabled>
                <el-tag size="small" type="info">{{ roleLabel }}</el-tag>
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

    <el-drawer
      v-model="mobileMenuOpen"
      direction="rtl"
      size="280px"
      :with-header="false"
      destroy-on-close
    >
      <div style="padding: 20px 0">
        <div style="font-weight: 800; font-size: 20px; margin-bottom: 20px">
          Меню
        </div>
        <div class="mobile-nav">
          <router-link
            v-if="!isAuthed"
            to="/"
            class="mobile-nav-item"
            :class="{ active: route.path === '/' }"
            >Главная</router-link
          >
          <router-link
            v-if="isAuthed"
            to="/properties"
            class="mobile-nav-item"
            :class="{ active: route.path === '/properties' }"
          >
            {{ isDeveloper ? "Мои объекты" : "Поиск" }}
          </router-link>
          <router-link
            to="/news"
            class="mobile-nav-item"
            :class="{ active: route.path === '/news' }"
            >Новости</router-link
          >
          <router-link
            to="/events"
            class="mobile-nav-item"
            :class="{ active: route.path === '/events' }"
            >Мероприятия</router-link
          >
          <router-link
            v-if="isAgent"
            to="/applications"
            class="mobile-nav-item"
            :class="{ active: route.path === '/applications' }"
            >Мои заявки</router-link
          >
          <router-link
            v-if="isAgent || isAdmin"
            to="/application-chats"
            class="mobile-nav-item"
            :class="{ active: route.path === '/application-chats' }"
          >
            Чаты заявок
            <el-tag
              v-if="appChats.unreadBadge"
              type="danger"
              size="small"
              effect="dark"
              round
            >
              {{ appChats.unreadBadge }}
            </el-tag>
          </router-link>
          <router-link
            v-if="isAdmin"
            to="/admin/chat"
            class="mobile-nav-item"
            :class="{ active: route.path === '/admin/chat' }"
          >
            Чат поддержки
            <el-tag
              v-if="supportStore.adminUnreadCount > 0"
              type="danger"
              size="small"
              effect="dark"
              round
              >{{ supportStore.adminUnreadCount }}</el-tag
            >
          </router-link>
          <router-link
            v-if="isManager"
            to="/incoming"
            class="mobile-nav-item"
            :class="{ active: route.path === '/incoming' }"
            >Входящие</router-link
          >

          <router-link
            v-if="isAuthed"
            to="/notifications"
            class="mobile-nav-item"
            :class="{ active: route.path === '/notifications' }"
          >
            Уведомления
            <el-tag
              v-if="notifications.unreadBadge"
              type="danger"
              size="small"
              effect="dark"
              round
              >{{ notifications.unreadBadge }}</el-tag
            >
          </router-link>

          <div v-if="!auth.user" style="margin-top: 20px">
            <el-button type="warning" style="width: 100%" @click="goLogin"
              >Войти</el-button
            >
          </div>
        </div>
      </div>
    </el-drawer>
  </el-header>
</template>

<script setup>
import { ref, computed, onBeforeUnmount, watch, onMounted } from "vue";
import { useRouter, useRoute } from "vue-router";
import { useAuthStore, apiClient } from "@/stores/auth";
import { useNotificationsStore } from "@/stores/notifications";
import { useSupportStore } from "@/stores/support";
import { useApplicationChatsStore } from "@/stores/applicationChats";
import { ArrowDown, Menu as MenuIcon } from "@element-plus/icons-vue";
import { getSocket } from "@/utils/socket";
import { ElNotification } from "element-plus";

const auth = useAuthStore();
const notifications = useNotificationsStore();
const supportStore = useSupportStore();
const appChats = useApplicationChatsStore();
const router = useRouter();
const route = useRoute();
const socket = getSocket();

const joinedAgentChatIds = ref(new Set());

async function subscribeAgentChats() {
  if (!auth.user || auth.user.role !== "agent") return;
  if (!auth.token) return;

  try {
    const { data } = await apiClient.get("/applications/chat/chats");
    const list = Array.isArray(data) ? data : [];
    for (const c of list) {
      const appId = Number(c?.applicationId);
      if (!Number.isFinite(appId)) continue;
      if (joinedAgentChatIds.value.has(appId)) continue;
      socket.emit("application_chat_join", {
        applicationId: appId,
        token: auth.token,
      });
      joinedAgentChatIds.value.add(appId);
    }
  } catch (e) {
    // Без критики: просто не будет realtime по "чужим" чатам до открытия экрана.
    console.warn("Failed to subscribe agent chats", e);
  }
}

const mobileMenuOpen = ref(false);

const active = computed(() => route.path);
const isAuthed = computed(() => !!auth.user);
const isAgent = computed(() => auth.user?.role === "agent");
const isDeveloper = computed(() => auth.user?.role === "developer");
const isAdmin = computed(() => auth.user?.role === "admin");
const isManager = computed(
  () =>
    (auth.user?.role === "developer" && auth.user?.developerApproved) ||
    auth.user?.role === "admin",
);

function toggleMobileMenu() {
  mobileMenuOpen.value = !mobileMenuOpen.value;
}

watch(
  () => route.path,
  () => {
    mobileMenuOpen.value = false;
  },
);

const avatarSrc = computed(() => auth.user?.avatarUrl || "");
const roleLabel = computed(() => {
  const role = auth.user?.role;
  if (role === "agent") return "Агент";
  if (role === "developer") return "Застройщик";
  if (role === "admin") return "Администратор";
  return "Пользователь";
});
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

// Admin Support Chat Logic
onMounted(async () => {
  if (isAdmin.value) {
    // 1. Fetch initial unread count
    try {
      const { data } = await apiClient.get("/support/chats");
      // Sum unread counts
      const total = data.reduce((sum, c) => sum + (c.unreadCount || 0), 0);
      supportStore.setAdminUnreadCount(total);
    } catch (e) {
      console.warn("Failed to fetch admin chats count", e);
    }

    // 2. Listen for new messages
    if (socket) {
      // Ensure admin room
      socket.emit("admin_subscribe");

      // Ensure global application chats room
      if (auth.token) {
        socket.emit("application_admin_subscribe", { token: auth.token });
      }

      socket.on("new_support_message", (msg) => {
        // Increment global count
        supportStore.incrementAdminUnreadCount();
      });
    }
  }

  if (isAgent.value) {
    await subscribeAgentChats();
  }
});

watch(
  () => auth.token,
  async () => {
    if (isAdmin.value && auth.token) {
      socket.emit("application_admin_subscribe", { token: auth.token });
    }
    if (isAgent.value) {
      await subscribeAgentChats();
    }
  },
);

watch(
  () => auth.user?.id,
  async (id) => {
    if (id) {
      notifications.connect(id);
      await notifications.refreshUnreadCount();

      if (auth.user?.role === "admin" || auth.user?.role === "agent") {
        appChats.connect({ userId: id });
      }
    } else {
      notifications.disconnect();
      appChats.disconnect();
      joinedAgentChatIds.value = new Set();
    }
  },
  { immediate: true },
);

watch(
  () => appChats.lastIncoming,
  (evt) => {
    if (!evt) return;
    // Не показываем всплывашку, если пользователь уже на экране чатов
    if (route.path === "/application-chats") return;

    const applicationId = evt.applicationId;
    const msg = evt.message;
    const text = String(msg?.text || "").trim();
    const label = text
      ? text
      : msg?.attachmentOriginalName
        ? `Файл: ${msg.attachmentOriginalName}`
        : "Новое сообщение";

    ElNotification({
      title: "Чаты заявок",
      message: `Заявка №${applicationId}: ${label}`,
      type: "info",
      duration: 4500,
    });
  },
);

onBeforeUnmount(() => {
  // Keep store alive, but avoid dangling listeners if header is remounted
  if (!auth.user?.id) notifications.disconnect();
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
.profile-avatar {
  flex: 0 0 auto;
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

.desktop-menu {
  flex: 1;
  display: flex;
  justify-content: center;
}

.mobile-toggle {
  display: none;
  cursor: pointer;
  color: #fff;
}

@media (max-width: 960px) {
  .desktop-menu {
    display: none;
  }
  .mobile-toggle {
    display: flex;
    align-items: center;
  }
  .desktop-only-btn {
    display: none;
  }
}

@media (max-width: 520px) {
  .app-header {
    padding: 0 var(--gap-md);
  }
  .header-inner {
    gap: var(--gap-sm);
  }
  .brand-text {
    display: none;
  }
  .profile-info {
    display: none;
  }
  .profile-caret {
    display: none;
  }
}

.mobile-nav-item {
  display: block;
  padding: 12px 0;
  color: var(--text-main);
  font-weight: 500;
  border-bottom: 1px solid var(--muted-bg);
}
.mobile-nav-item.active {
  color: var(--accent-yellow-dark);
}
</style>
