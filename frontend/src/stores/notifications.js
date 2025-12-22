import { computed, ref } from "vue";
import { defineStore } from "pinia";
import { apiClient } from "./auth";
import { getSocket } from "@/utils/socket";
import { playNotificationSound } from "@/utils/notificationSound";

export const useNotificationsStore = defineStore("notifications", () => {
  const items = ref([]);
  const loading = ref(false);
  const unreadCount = ref(0);
  const page = ref(1);
  const limit = ref(20);
  const total = ref(0);

  let socket;
  let subscribedUserId = null;

  const unreadBadge = computed(() => {
    const n = Number(unreadCount.value || 0);
    if (!Number.isFinite(n) || n <= 0) return "";
    return n > 99 ? "99+" : String(n);
  });

  function reset() {
    items.value = [];
    loading.value = false;
    unreadCount.value = 0;
    page.value = 1;
    limit.value = 20;
    total.value = 0;
    subscribedUserId = null;
  }

  function handleIncoming(note) {
    if (!note) return;
    items.value = [note, ...items.value];
    if (!note.isRead) {
      unreadCount.value = Number(unreadCount.value || 0) + 1;
      playNotificationSound();
    }
  }

  function connect(userId) {
    if (!userId) return;
    if (subscribedUserId === userId && socket) return;

    socket = getSocket();
    subscribedUserId = userId;

    socket.emit("subscribe", userId);
    socket.off("notification", handleIncoming);
    socket.on("notification", handleIncoming);
  }

  function disconnect() {
    if (socket) {
      socket.off("notification", handleIncoming);
    }
    reset();
  }

  async function refreshUnreadCount() {
    try {
      const { data } = await apiClient.get("/notifications/unread-count");
      unreadCount.value = Number.isFinite(Number(data?.count))
        ? Number(data.count)
        : 0;
    } catch (_) {
      // fallback
      unreadCount.value = Array.isArray(items.value)
        ? items.value.filter((n) => !n?.isRead).length
        : 0;
    }
  }

  async function load(params = {}) {
    loading.value = true;
    try {
      const { data } = await apiClient.get("/notifications", { params });
      if (Array.isArray(data)) {
        items.value = data;
        total.value = data.length;
        page.value = 1;
        limit.value = data.length;
      } else {
        items.value = Array.isArray(data?.items) ? data.items : [];
        total.value = Number.isFinite(Number(data?.total))
          ? Number(data.total)
          : items.value.length;
        page.value = Number.isFinite(Number(data?.page))
          ? Number(data.page)
          : Number(params?.page || 1);
        limit.value = Number.isFinite(Number(data?.limit))
          ? Number(data.limit)
          : Number(params?.limit || 20);
      }
    } finally {
      loading.value = false;
    }
  }

  async function markRead(id) {
    if (!id) return;
    const idx = items.value.findIndex((n) => n?.id === id);
    const wasUnread = idx >= 0 ? !items.value[idx]?.isRead : false;

    await apiClient.post(`/notifications/${id}/read`);

    if (idx >= 0) {
      items.value[idx] = { ...items.value[idx], isRead: true };
    }
    if (wasUnread) {
      unreadCount.value = Math.max(0, Number(unreadCount.value || 0) - 1);
    }
  }

  return {
    items,
    loading,
    unreadCount,
    page,
    limit,
    total,
    unreadBadge,
    connect,
    disconnect,
    refreshUnreadCount,
    load,
    markRead,
  };
});
