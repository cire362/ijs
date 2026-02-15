<script setup>
import { ref, onMounted, onBeforeUnmount, computed, nextTick } from "vue";
import { useAuthStore, apiClient } from "../stores/auth";
import { useSupportStore } from "../stores/support";
import { getSocket } from "../utils/socket";
import { UserFilled, Avatar, ArrowLeft } from "@element-plus/icons-vue";

const auth = useAuthStore();
const supportStore = useSupportStore();
const socket = getSocket();

const chats = ref([]); // List of active chats/rooms
const activeListTab = ref("new"); // 'new' | 'resolved'
const activeChatId = ref(null);
const activeChatMessages = ref([]);
const replyText = ref("");
const messagesContainer = ref(null);

const isMobile = ref(false);
function onResize() {
  isMobile.value = window.innerWidth <= 768;
}

const onNewSupportMessage = (msg) => {
  // msg: { roomId, text, senderName, senderEmail, timestamp ... }

  // Update chat list
  const existingChat = chats.value.find((c) => c.roomId === msg.roomId);
  if (existingChat) {
    existingChat.lastMessage = msg.text;
    existingChat.lastTime = msg.timestamp;

    // If chat was resolved, move it back to new
    if (msg.movedToNew || msg.isResolved === false) {
      existingChat.isResolved = false;
      if (msg.movedToNew && activeListTab.value === "resolved") {
        activeListTab.value = "new";
      }
    }

    // Only increment if not currently active
    if (activeChatId.value !== msg.roomId) {
      existingChat.unreadCount = (existingChat.unreadCount || 0) + 1;
    }

    // Move chat to top
    const idx = chats.value.findIndex((c) => c.roomId === msg.roomId);
    if (idx > 0) {
      chats.value.splice(idx, 1);
      chats.value.unshift(existingChat);
    }

    updateGlobalCounter();

    // If this is the active chat, append message
    if (activeChatId.value === msg.roomId) {
      activeChatMessages.value.push({
        text: msg.text,
        sender: "user",
        time: msg.timestamp,
      });
      scrollToBottom();
    }
  } else {
    // New Chat
    chats.value.unshift({
      roomId: msg.roomId,
      senderName: msg.senderName || "Гость",
      senderEmail: msg.senderEmail,
      lastMessage: msg.text,
      lastTime: msg.timestamp,
      unreadCount: 1,
      isResolved: false,
    });
    updateGlobalCounter();
  }
};

// Computed active chat object
const activeChat = computed(() =>
  chats.value.find((c) => c.roomId === activeChatId.value),
);

const newChats = computed(() => chats.value.filter((c) => !c.isResolved));

const resolvedChats = computed(() => chats.value.filter((c) => c.isResolved));

const visibleChats = computed(() =>
  activeListTab.value === "resolved" ? resolvedChats.value : newChats.value,
);

onMounted(async () => {
  onResize();
  window.addEventListener("resize", onResize);
  // Join admin room
  if (auth.token) {
    socket.emit("admin_subscribe", { token: auth.token });
  }

  // Load existing chats (Prototype: we'll build list from incoming events for now,
  // or fetch from API if we implemented that. For this MVP, we might only see new activity
  // unless we fetch from DB. Let's add a fetch method later.)

  // Listen for new messages from users
  socket.on("new_support_message", onNewSupportMessage);

  // Try to fetch initial state if API exists (we can stub this or actually implement it)
  await fetchActiveChats();
});

onBeforeUnmount(() => {
  window.removeEventListener("resize", onResize);
  socket.off("new_support_message", onNewSupportMessage);
});

const updateGlobalCounter = () => {
  const total = chats.value.reduce((sum, c) => sum + (c.unreadCount || 0), 0);
  supportStore.setAdminUnreadCount(total);
};

const fetchActiveChats = async () => {
  try {
    const { data } = await apiClient.get("/support/chats");
    chats.value = data;
    updateGlobalCounter();
  } catch (e) {
    console.error("Failed to load chats", e);
  }
};

const setResolved = async (wantResolved) => {
  if (!activeChat.value) return;
  try {
    await apiClient.post("/support/chats/resolve", {
      roomId: activeChat.value.roomId,
      resolved: wantResolved,
    });
    const chat = chats.value.find((c) => c.roomId === activeChat.value.roomId);
    if (chat) {
      chat.isResolved = wantResolved;
      if (!wantResolved) {
        chat.resolvedAt = null;
        chat.resolvedBy = null;
      }
    }

    // Keep the chat visible in list after change
    if (wantResolved && activeListTab.value === "new")
      activeListTab.value = "resolved";
    if (!wantResolved && activeListTab.value === "resolved")
      activeListTab.value = "new";
  } catch (e) {
    console.error("Failed to change resolve status", e);
  }
};

const selectChat = async (chat) => {
  activeChatId.value = chat.roomId;

  if (chat.unreadCount > 0) {
    // Mark read on server
    try {
      await apiClient.post("/support/read", { roomId: chat.roomId });
    } catch (e) {
      console.error(e);
    }
  }

  chat.unreadCount = 0;
  updateGlobalCounter();

  // Fetch history for this room
  // For MVP, we'll just start empty or use what we captured in session
  // Ideally: await axios.get(`/api/support/messages/${chat.roomId}`)

  // Reset messages for view (in real app, merge with history)
  activeChatMessages.value = [];
  // If we had history in `chat.messages`, use it

  // Attempt to fetch history from server?
  // Let's implement a quick API on backend for history to make this usable
  try {
    const { data } = await apiClient.get(
      `/support/history?roomId=${chat.roomId}`,
    );
    activeChatMessages.value = data.map((m) => ({
      text: m.text,
      sender: m.isAdmin ? "support" : "user",
      time: m.createdAt,
    }));
    scrollToBottom();
  } catch (e) {
    console.log("No history API yet", e);
  }
};

const sendReply = () => {
  if (!replyText.value.trim() || !activeChatId.value) return;

  const text = replyText.value.trim();

  // Emit socket event
  socket.emit("admin_reply", {
    roomId: activeChatId.value,
    text: text,
    token: auth.token,
  });

  // Optimistic UI
  activeChatMessages.value.push({
    text: text,
    sender: "support",
    time: new Date(),
  });

  replyText.value = "";
  scrollToBottom();
};

const scrollToBottom = async () => {
  await nextTick();
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
  }
};

const formatTime = (date) => {
  if (!date) return "";
  return new Date(date).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
};
</script>

<template>
  <div class="h-[calc(100vh-140px)] flex md:gap-6 mt-6">
    <!-- Chat List -->
    <div
      v-show="!isMobile || !activeChatId"
      class="w-full md:w-1/3 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col"
    >
      <div class="p-4 border-b border-gray-100 font-bold text-gray-700">
        <div class="flex items-center justify-between gap-3">
          <span>Обращения</span>
        </div>
      </div>
      <div class="px-4 pt-2 pb-3 border-b border-gray-100">
        <el-tabs v-model="activeListTab" class="support-tabs">
          <el-tab-pane :label="`Новые (${newChats.length})`" name="new" />
          <el-tab-pane
            :label="`Выполненные (${resolvedChats.length})`"
            name="resolved"
          />
        </el-tabs>
      </div>
      <div class="overflow-y-auto flex-1">
        <div
          v-if="visibleChats.length === 0"
          class="p-8 text-center text-gray-400 text-sm"
        >
          Нет чатов
        </div>
        <div
          v-for="chat in visibleChats"
          :key="chat.roomId"
          @click="selectChat(chat)"
          class="p-4 border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition"
          :class="{
            'bg-blue-50 hover:bg-blue-50': activeChatId === chat.roomId,
          }"
        >
          <div class="flex justify-between items-start mb-1">
            <div class="font-bold text-sm text-gray-900 truncate">
              {{ chat.senderName }}
            </div>
            <div class="text-xs text-gray-400">
              {{ formatTime(chat.lastTime) }}
            </div>
          </div>
          <div class="text-xs text-gray-500 mb-1 truncate">
            {{ chat.senderEmail }}
          </div>
          <div
            class="text-sm text-gray-600 truncate flex justify-between items-center"
          >
            <span>{{ chat.lastMessage }}</span>
            <span
              v-if="chat.unreadCount"
              class="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full"
              >{{ chat.unreadCount }}</span
            >
          </div>
        </div>
      </div>
    </div>

    <!-- Active Chat -->
    <div
      v-show="!isMobile || activeChatId"
      class="w-full md:flex-1 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col relative"
    >
      <div
        v-if="!activeChat"
        class="flex-1 flex items-center justify-center text-gray-400"
      >
        Выберите чат из списка
      </div>
      <template v-else>
        <div
          class="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50"
        >
          <div class="flex items-center gap-3 overflow-hidden">
            <el-button
              v-if="isMobile"
              :icon="ArrowLeft"
              circle
              size="small"
              @click="activeChatId = null"
            />
            <div
              class="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold shrink-0"
            >
              {{ activeChat.senderName?.[0]?.toUpperCase() }}
            </div>
            <div class="overflow-hidden">
              <div class="font-bold text-sm truncate">
                {{ activeChat.senderName }}
              </div>
              <div class="text-xs text-gray-500 truncate">
                {{ activeChat.senderEmail }}
              </div>
            </div>
          </div>
          <div class="flex items-center gap-3 shrink-0 ml-2">
            <el-button
              v-if="!activeChat.isResolved"
              size="small"
              type="success"
              plain
              @click="setResolved(true)"
              >Пометить выполненным</el-button
            >
            <el-button
              v-else
              size="small"
              type="warning"
              plain
              @click="setResolved(false)"
              >Вернуть в новые</el-button
            >
            <div class="text-xs text-gray-400 font-mono">
              {{ activeChat.roomId.slice(0, 8) }}...
            </div>
          </div>
        </div>

        <div
          ref="messagesContainer"
          class="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50/50"
        >
          <div
            v-for="(msg, i) in activeChatMessages"
            :key="i"
            class="flex flex-col gap-1"
          >
            <div
              class="max-w-[80%] p-3 rounded-2xl text-sm"
              :class="
                msg.sender === 'support'
                  ? 'bg-blue-600 text-white self-end rounded-br-none'
                  : 'bg-white border border-gray-200 text-gray-800 self-start rounded-bl-none'
              "
            >
              {{ msg.text }}
            </div>
            <div
              class="text-[10px] text-gray-400"
              :class="msg.sender === 'support' ? 'self-end' : 'self-start'"
            >
              {{ formatTime(msg.time) }}
            </div>
          </div>
        </div>

        <div class="p-4 border-t border-gray-100 bg-white">
          <div class="flex gap-2">
            <input
              v-model="replyText"
              @keyup.enter="sendReply"
              placeholder="Напишите ответ..."
              class="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 transition"
            />
            <button
              @click="sendReply"
              class="bg-blue-600 hover:bg-blue-700 text-white px-6 rounded-xl font-medium transition"
            >
              Send
            </button>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
