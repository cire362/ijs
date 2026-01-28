import { computed, ref } from "vue";
import { defineStore } from "pinia";
import { getSocket } from "@/utils/socket";
import { playNotificationSound } from "@/utils/notificationSound";

export const useApplicationChatsStore = defineStore("applicationChats", () => {
  const unreadByApplicationId = ref({});
  const activeApplicationId = ref(null);
  const currentUserId = ref(null);
  const connected = ref(false);
  const lastIncoming = ref(null);

  let socket = null;
  let socketHandler = null;

  const totalUnread = computed(() => {
    return Object.values(unreadByApplicationId.value).reduce(
      (sum, v) => sum + Number(v || 0),
      0,
    );
  });

  const unreadBadge = computed(() => {
    const n = Number(totalUnread.value || 0);
    if (!Number.isFinite(n) || n <= 0) return "";
    return n > 99 ? "99+" : String(n);
  });

  function getUnread(applicationId) {
    const id = Number(applicationId);
    if (!Number.isFinite(id)) return 0;
    return Number(unreadByApplicationId.value[id] || 0);
  }

  function setActive(id) {
    const appId = id == null ? null : Number(id);
    activeApplicationId.value = Number.isFinite(appId) ? appId : null;

    if (activeApplicationId.value) {
      unreadByApplicationId.value = {
        ...unreadByApplicationId.value,
        [activeApplicationId.value]: 0,
      };
    }
  }

  function reset() {
    unreadByApplicationId.value = {};
    activeApplicationId.value = null;
    currentUserId.value = null;
    connected.value = false;
    lastIncoming.value = null;
  }

  function connect({ userId } = {}) {
    const uid = Number(userId);
    currentUserId.value = Number.isFinite(uid) ? uid : null;

    if (connected.value) return;

    socket = getSocket();

    socketHandler = (payload) => {
      const applicationId = Number(payload?.applicationId);
      const message = payload?.message;
      if (!Number.isFinite(applicationId) || !message) return;

      const senderId = Number(message?.senderId ?? message?.sender?.id);
      const mine =
        Number.isFinite(senderId) &&
        Number.isFinite(currentUserId.value) &&
        senderId === Number(currentUserId.value);

      if (mine) return;

      if (
        activeApplicationId.value &&
        activeApplicationId.value === applicationId
      ) {
        // Чат открыт — считаем прочитанным
        return;
      }

      unreadByApplicationId.value = {
        ...unreadByApplicationId.value,
        [applicationId]:
          Number(unreadByApplicationId.value[applicationId] || 0) + 1,
      };

      lastIncoming.value = { applicationId, message, at: Date.now() };
      playNotificationSound();
    };

    socket.off("application_chat_message", socketHandler);
    socket.on("application_chat_message", socketHandler);

    connected.value = true;
  }

  function disconnect() {
    if (socket && socketHandler) {
      socket.off("application_chat_message", socketHandler);
    }
    socket = null;
    socketHandler = null;
    reset();
  }

  return {
    unreadByApplicationId,
    activeApplicationId,
    lastIncoming,
    totalUnread,
    unreadBadge,
    getUnread,
    setActive,
    connect,
    disconnect,
    reset,
  };
});
