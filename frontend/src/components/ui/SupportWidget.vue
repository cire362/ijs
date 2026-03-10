<script setup>
import { ref, watch, nextTick, computed, onMounted } from "vue";
import { useAuthStore, apiClient } from "../../stores/auth";
import { useSupportStore } from "../../stores/support";
import { getSocket } from "../../utils/socket";
import {
  Close,
  Promotion,
  UserFilled,
  ChatDotRound,
} from "@element-plus/icons-vue";

const GUEST_SESSION_STORAGE_KEY = "chat_guest_session";

const socket = getSocket();
const supportStore = useSupportStore();

const isOpen = computed({
  get: () => supportStore.isOpen,
  set: (val) => (supportStore.isOpen = val),
});

const auth = useAuthStore();
const messagesRef = ref(null);
const loading = ref(false);
const messageInput = ref("");
const roomId = ref(null);
const guestSession = ref(null);
const unreadCount = ref(0); // Local unread count for user

const userDisplayName = computed(() => {
  const u = auth.user;
  if (!u) return "";
  return (
    u.fullName ||
    [u.lastName, u.firstName, u.middleName].filter(Boolean).join(" ") ||
    u.name ||
    ""
  );
});

// History of chat
const messages = ref([
  {
    id: 1,
    text: "Здравствуйте! Чем мы можем вам помочь?",
    isBot: true,
    time: new Date(),
  },
]);

const resetChatUiState = () => {
  loading.value = false;
  messageInput.value = "";
  unreadCount.value = 0;
  guestData.value = { name: "", email: "" };
  messages.value = [
    {
      id: 1,
      text: "Здравствуйте! Чем мы можем вам помочь?",
      isBot: true,
      time: new Date(),
    },
  ];
};

const ensureGuestRoom = () => {
  if (roomId.value && guestSession.value?.guestToken) return roomId.value;
  return null;
};

function saveGuestSession(session) {
  guestSession.value = session;
  roomId.value = session?.roomId || null;

  try {
    if (session) {
      localStorage.setItem(GUEST_SESSION_STORAGE_KEY, JSON.stringify(session));
    } else {
      localStorage.removeItem(GUEST_SESSION_STORAGE_KEY);
    }
  } catch {
    // Ignore
  }
}

function restoreGuestSession() {
  try {
    const raw = localStorage.getItem(GUEST_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed.roomId === "string" &&
      typeof parsed.guestToken === "string"
    ) {
      return parsed;
    }
  } catch {
    // Ignore
  }

  return null;
}

async function ensureGuestSession() {
  if (auth.user) return null;

  const current = guestSession.value || restoreGuestSession();
  const { data } = await apiClient.post("/support/guest-session", {
    roomId: current?.roomId || null,
    guestToken: current?.guestToken || null,
  });

  if (data?.roomId && data?.guestToken) {
    saveGuestSession({ roomId: data.roomId, guestToken: data.guestToken });
    return guestSession.value;
  }

  throw new Error("Guest support session was not issued");
}

function joinCurrentSupportRoom() {
  if (!socket || !roomId.value) return;
  socket.emit("join_room", {
    roomId: roomId.value,
    token: auth.token,
    guestToken: guestSession.value?.guestToken || null,
  });
}

// Guest data if not logged in
const guestData = ref({
  name: "",
  email: "",
});

const loadHistory = async (id) => {
  try {
    const headers = guestSession.value?.guestToken
      ? { "x-support-guest-token": guestSession.value.guestToken }
      : undefined;
    const { data } = await apiClient.get(`/support/history?roomId=${id}`, {
      headers,
    });
    // Merge history, keeping the welcome message if empty?
    if (data && data.length > 0) {
      messages.value = [
        messages.value[0], // Keep welcome
        ...data.map((m) => ({
          id: m.id || Date.now() + Math.random(),
          text: m.text,
          isBot: m.isAdmin, // support messages are isAdmin=true
          time: m.createdAt,
        })),
      ];
      scrollToBottom();
    }
  } catch (e) {
    if (!auth.user) {
      saveGuestSession(null);
    }
    console.warn("Failed to load chat history", e);
  }
};

onMounted(() => {
  // Determine/Restore Room ID (initial)
  if (auth.user) {
    roomId.value = `user:${auth.user.id}`;
  } else {
    const storedGuestSession = restoreGuestSession();
    if (storedGuestSession) {
      guestSession.value = storedGuestSession;
      roomId.value = storedGuestSession.roomId;
    }
  }

  if (socket) {
    const setupRoom = () => {
      if (roomId.value) {
        joinCurrentSupportRoom();
      }
    };

    if (socket.connected) setupRoom();

    socket.on("connect", setupRoom);

    socket.on("chat_message", (msg) => {
      messages.value.push({
        id: Date.now(),
        text: msg.text,
        isBot: msg.sender === "support",
        time: msg.timestamp || new Date(),
      });
      scrollToBottom();

      if (!isOpen.value && msg.sender === "support") {
        unreadCount.value++;
      }
    });

    socket.on("support_auth_error", async (payload) => {
      if (payload?.code !== "invalid_guest_session" || auth.user) return;
      saveGuestSession(null);
      roomId.value = null;
    });
  }

  if (roomId.value) {
    void loadHistory(roomId.value);
  }
});

watch(
  () => auth.user?.id,
  async (id, previousId) => {
    if (id) {
      guestData.value.name = userDisplayName.value;
      guestData.value.email = auth.user?.email || "";
      saveGuestSession(null);
      roomId.value = `user:${id}`;

      joinCurrentSupportRoom();
      await loadHistory(roomId.value);
    } else if (previousId) {
      // Logged out: clear UI and drop any previous room bindings.
      resetChatUiState();
      roomId.value = null;
      saveGuestSession(null);

      // Important: socket.io rooms are server-side; easiest way to leave old rooms
      // is to reconnect.
      if (socket) {
        try {
          socket.disconnect();
          socket.connect();
        } catch {
          // Ignore
        }
      }
    }
  },
  { immediate: true },
);

// Watch open to scroll to bottom
watch(isOpen, async (val) => {
  if (val) {
    unreadCount.value = 0;
    await scrollToBottom();
  }
});

const scrollToBottom = async () => {
  await nextTick();
  if (messagesRef.value) {
    messagesRef.value.scrollTop = messagesRef.value.scrollHeight;
  }
};

const formatTime = (date) => {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
};

const sendMessage = async () => {
  const text = messageInput.value.trim();
  if (!text) return;

  // Add user message
  messages.value.push({
    id: Date.now(),
    text: text,
    isBot: false,
    time: new Date(),
  });

  messageInput.value = "";
  await scrollToBottom();

  if (!auth.user && (!guestData.value.name || !guestData.value.email)) {
    // Bot asks for details
    setTimeout(async () => {
      messages.value.push({
        id: Date.now() + 1,
        text: "Пожалуйста, укажите ваше имя и Email, чтобы мы могли ответить вам.",
        isBot: true,
        isForm: true, // Special type to show inputs
        time: new Date(),
      });
      await scrollToBottom();
    }, 600);
    return;
  }

  await processSubmission(text);
};

const submitGuestForm = async () => {
  if (!guestData.value.name || !guestData.value.email) return;

  // Simple email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(guestData.value.email)) {
    messages.value.push({
      id: Date.now(),
      text: "Пожалуйста, введите корректный Email.",
      isBot: true,
      isError: true, // we can style this red
      time: new Date(),
    });
    scrollToBottom();
    return;
  }

  // Remove form request message or just confirm
  messages.value.push({
    id: Date.now(),
    text: `Меня зовут ${guestData.value.name}, email: ${guestData.value.email}`,
    isBot: false,
    time: new Date(),
  });

  messages.value.push({
    id: Date.now() + 2,
    text: "Спасибо! Отправляем ваш запрос...",
    isBot: true,
    time: new Date(),
  });

  const lastMsg =
    [...messages.value].reverse().find((m) => !m.isBot && !m.isSys && !m.isForm)
      ?.text || "Contact info updated";
  await processSubmission(lastMsg);
};

const processSubmission = async (text) => {
  loading.value = true;
  try {
    const senderName =
      userDisplayName.value || auth.user?.name || guestData.value.name;
    const senderEmail = auth.user?.email || guestData.value.email;

    if (!auth.user) {
      await ensureGuestSession();
      joinCurrentSupportRoom();
    } else if (roomId.value && socket) {
      joinCurrentSupportRoom();
    }

    // Send via Socket
    socket.emit("chat_message", {
      text: text,
      sender: "user",
      senderName,
      senderEmail,
      token: auth.token,
      guestToken: guestSession.value?.guestToken || null,
      // legacy keys (backward compatibility)
      name: senderName,
      email: senderEmail,
      roomId: roomId.value, // Send current room
    });
  } catch (e) {
    messages.value.push({
      id: Date.now() + 4,
      text: "Произошла ошибка при отправке. Попробуйте позже.",
      isBot: true,
      isError: true,
      time: new Date(),
    });
    await scrollToBottom();
  } finally {
    loading.value = false;
  }
};
</script>

<template>
  <div
    v-if="isOpen"
    class="fixed bottom-6 right-6 z-50 flex flex-col w-full max-w-[380px] h-[500px] bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden font-sans animate-fade-in-up chat-widget-window"
  >
    <!-- Header -->
    <div
      class="bg-gray-900 text-white p-4 flex justify-between items-center shadow-sm"
    >
      <div class="flex items-center gap-3">
        <div class="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
        <div>
          <h3 class="font-bold text-sm">Поддержка</h3>
          <p class="text-[10px] text-gray-400">Онлайн</p>
        </div>
      </div>
      <button
        @click="supportStore.close()"
        class="hover:bg-gray-700 p-1 rounded transition"
      >
        <el-icon><Close /></el-icon>
      </button>
    </div>

    <!-- Messages Area -->
    <div
      ref="messagesRef"
      class="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 scroll-smooth"
    >
      <div v-for="msg in messages" :key="msg.id" class="flex flex-col gap-1">
        <!-- Bot Message -->
        <div
          v-if="msg.isBot"
          class="flex items-end gap-2 max-w-[85%] self-start"
        >
          <div
            class="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center shrink-0"
          >
            <el-icon :size="12" class="text-gray-500"><UserFilled /></el-icon>
          </div>

          <div class="flex flex-col gap-2">
            <div
              v-if="!msg.isForm"
              class="bg-white p-3 rounded-2xl rounded-bl-sm shadow-sm border border-gray-100 text-sm text-gray-700"
            >
              {{ msg.text }}
            </div>

            <!-- Helper Form inside Chat -->
            <div
              v-if="msg.isForm"
              class="bg-white p-4 rounded-2xl rounded-bl-sm shadow-sm border border-gray-100 text-sm w-full space-y-3"
            >
              <p class="mb-1">{{ msg.text }}</p>
              <input
                v-model="guestData.name"
                class="w-full border border-gray-200 rounded px-3 py-2 text-xs focus:outline-none focus:border-blue-500"
                placeholder="Ваше имя"
              />
              <input
                v-model="guestData.email"
                class="w-full border border-gray-200 rounded px-3 py-2 text-xs focus:outline-none focus:border-blue-500"
                placeholder="Email"
              />
              <button
                @click="submitGuestForm"
                class="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded text-xs font-medium transition"
              >
                Подтвердить
              </button>
            </div>

            <span v-if="!msg.isForm" class="text-[10px] text-gray-400 ml-1">{{
              formatTime(msg.time)
            }}</span>
          </div>
        </div>

        <!-- User Message -->
        <div v-else class="flex flex-col items-end max-w-[85%] self-end">
          <div
            class="bg-blue-600 text-white p-3 rounded-2xl rounded-tr-sm shadow-md text-sm"
          >
            {{ msg.text }}
          </div>
          <span class="text-[10px] text-gray-400 mr-1">{{
            formatTime(msg.time)
          }}</span>
        </div>
      </div>
    </div>

    <!-- Input Area -->
    <div class="p-3 bg-white border-t border-gray-100">
      <div
        class="relative flex items-center bg-gray-50 rounded-full border border-gray-200 px-2 py-1 focus-within:ring-2 focus-within:ring-blue-100 transition"
      >
        <input
          v-model="messageInput"
          @keyup.enter="sendMessage"
          type="text"
          placeholder="Напишите сообщение..."
          class="flex-1 bg-transparent border-none text-sm px-3 py-2 focus:outline-none text-gray-700"
        />
        <button
          @click="sendMessage"
          :disabled="loading || !messageInput.trim()"
          class="w-8 h-8 flex items-center justify-center bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded-full transition shadow-sm ml-1"
        >
          <el-icon v-if="!loading"><Promotion /></el-icon>
          <div
            v-else
            class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"
          ></div>
        </button>
      </div>
      <div class="text-[10px] text-gray-400 text-center mt-2">
        IJS Hub Support
      </div>
    </div>
  </div>

  <button
    v-else
    @click="supportStore.open()"
    class="fixed bottom-6 right-6 z-50 w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg flex items-center justify-center transition hover:scale-110 active:scale-95 group chat-toggle-btn"
  >
    <el-badge
      :value="unreadCount"
      :hidden="unreadCount === 0"
      class="flex items-center justify-center"
    >
      <el-icon :size="28"><ChatDotRound /></el-icon>
    </el-badge>
  </button>
</template>

<style scoped>
.chat-toggle-btn {
  /* Ensure it stays within viewport on mobile */
  right: max(16px, env(safe-area-inset-right));
  bottom: max(24px, env(safe-area-inset-bottom));
  transform-origin: bottom right;
}

@media (min-width: 640px) {
  .chat-toggle-btn {
    right: max(24px, env(safe-area-inset-right));
  }
}

@media (hover: none) {
  .chat-toggle-btn:hover {
    transform: none !important;
  }
}

@media (max-width: 480px) {
  .chat-widget-window {
    width: calc(100vw - 32px) !important;
    right: 16px !important;
    bottom: 80px !important;
    height: 60vh !important;
  }
}

.animate-fade-in-up {
  animation: fadeInUp 0.3s ease-out;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
