<script setup>
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from "vue";
import { useRoute, useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import { useAuthStore, apiClient } from "../stores/auth";
import { humanizeApiError } from "@/utils/errors";
import { personName } from "@/utils/person";
import { getSocket } from "@/utils/socket";
import { useApplicationChatsStore } from "@/stores/applicationChats";

const auth = useAuthStore();
const route = useRoute();
const router = useRouter();
const socket = getSocket();
const applicationChats = useApplicationChatsStore();

const chatsLoading = ref(false);
const chats = ref([]);

const activeApplicationId = ref(null);
const activeMessages = ref([]);
const messagesLoading = ref(false);

const text = ref("");
const sending = ref(false);
const fileList = ref([]);
const messagesContainer = ref(null);
const knownMessageIds = ref(new Set());
const joinedApplicationId = ref(null);
const joinedApplicationIds = ref(new Set());

const filterText = ref("");
const onlyUnread = ref(false);

const isAdmin = computed(() => auth.user?.role === "admin");

function chatTitle(chat) {
  if (!chat) return "";
  return chat.title || `Заявка №${chat.applicationId}`;
}

function agentLabel(agent) {
  return personName(agent) || agent?.email || (agent?.id ? `#${agent.id}` : "");
}

function formatTime(date) {
  if (!date) return "";
  return new Date(date).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateTimeRu(date) {
  if (!date) return "";
  return new Date(date).toLocaleString([], {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function scrollToBottom() {
  await nextTick();
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
  }
}

async function loadChats() {
  chatsLoading.value = true;
  try {
    const { data } = await apiClient.get("/applications/chat/chats");
    chats.value = Array.isArray(data) ? data : [];

    // For agents: subscribe to all their application rooms for notifications
    if (auth.user?.role === "agent" && auth.token && socket) {
      for (const c of chats.value) {
        const id = Number(c?.applicationId);
        if (!Number.isFinite(id)) continue;
        if (joinedApplicationIds.value.has(id)) continue;
        socket.emit("application_chat_join", {
          applicationId: id,
          token: auth.token,
        });
        joinedApplicationIds.value.add(id);
      }
    }

    // Auto-select chat from query (?appId=123) or first one
    const qId = parseInt(route.query.appId, 10);
    const initialId = Number.isFinite(qId) ? qId : null;

    if (initialId && chats.value.some((c) => c.applicationId === initialId)) {
      await selectChatById(initialId);
    } else if (!activeApplicationId.value && chats.value.length) {
      // keep empty if user doesn't want auto open? mimic AdminChatView: open none
    }
  } catch (err) {
    ElMessage.error(humanizeApiError(err, "Не удалось загрузить чаты"));
  } finally {
    chatsLoading.value = false;
  }
}

async function loadMessages(applicationId) {
  messagesLoading.value = true;
  try {
    const { data } = await apiClient.get(
      `/applications/${applicationId}/chat/messages`,
    );
    activeMessages.value = Array.isArray(data) ? data : [];
    knownMessageIds.value = new Set(
      activeMessages.value.map((m) => m?.id).filter(Boolean),
    );
    await scrollToBottom();
  } catch (err) {
    ElMessage.error(humanizeApiError(err, "Не удалось загрузить сообщения"));
  } finally {
    messagesLoading.value = false;
  }
}

async function selectChat(chat) {
  if (!chat?.applicationId) return;
  await selectChatById(chat.applicationId);
}

async function selectChatById(id) {
  activeApplicationId.value = id;
  applicationChats.setActive(id);
  await loadMessages(id);

  // Realtime:
  // - Admin subscribes to a global room (application_admins)
  // - Agent joins rooms for their applications (done in loadChats + fallback here)
  if (auth.user?.role === "agent" && auth.token && socket) {
    const appId = Number(id);
    if (Number.isFinite(appId) && !joinedApplicationIds.value.has(appId)) {
      socket.emit("application_chat_join", {
        applicationId: appId,
        token: auth.token,
      });
      joinedApplicationIds.value.add(appId);
    }
  }

  // Keep URL in sync
  router.replace({
    path: "/application-chats",
    query: { appId: String(id) },
  });
}

function isMine(m) {
  const myId = auth.user?.id;
  const senderId = m?.senderId ?? m?.sender?.id;
  return Boolean(myId && senderId && Number(senderId) === Number(myId));
}

function pushIncomingMessage(applicationId, message) {
  if (!applicationId || !message) return;
  if (activeApplicationId.value !== applicationId) return;

  const id = message?.id;
  if (id && knownMessageIds.value.has(id)) return;
  if (id) knownMessageIds.value.add(id);

  activeMessages.value.push(message);
  scrollToBottom();
}

function applyChatPreview(applicationId, message) {
  if (!applicationId || !message) return;
  const idx = chats.value.findIndex((c) => c.applicationId === applicationId);
  if (idx < 0) return;

  const previewText = String(message?.text || "").trim();
  const preview =
    previewText ||
    (message?.attachmentOriginalName
      ? `Файл: ${message.attachmentOriginalName}`
      : "");
  chats.value[idx] = {
    ...chats.value[idx],
    lastMessage: preview,
    lastTime: message?.createdAt || new Date(),
  };
}

function beforeUpload(file) {
  const allowed = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ];

  if (!allowed.includes(file.type)) {
    ElMessage.error("Разрешены только PDF/DOC/DOCX");
    return false;
  }

  const maxMb = 15;
  if (file.size > maxMb * 1024 * 1024) {
    ElMessage.error(`Максимальный размер файла: ${maxMb} МБ`);
    return false;
  }

  return true;
}

function onFileChange(uploadFile, uploadFiles) {
  fileList.value = Array.isArray(uploadFiles) ? uploadFiles.slice(-1) : [];
}

function clearFile() {
  fileList.value = [];
}

const canSend = computed(() => {
  return Boolean(String(text.value || "").trim() || fileList.value.length);
});

const filteredChats = computed(() => {
  const q = String(filterText.value || "")
    .trim()
    .toLowerCase();
  const all = Array.isArray(chats.value) ? chats.value : [];

  return all.filter((c) => {
    const appId = Number(c?.applicationId);
    if (onlyUnread.value && applicationChats.getUnread(appId) <= 0)
      return false;

    if (!q) return true;

    const hay = [
      String(c?.title || ""),
      String(c?.lastMessage || ""),
      String(c?.applicationId || ""),
      isAdmin.value ? agentLabel(c?.agent) : "",
    ]
      .join(" ")
      .toLowerCase();

    return hay.includes(q);
  });
});

const onSocketMessage = (payload) => {
  const applicationId = payload?.applicationId;
  const message = payload?.message;
  applyChatPreview(applicationId, message);
  pushIncomingMessage(applicationId, message);
};

async function send() {
  if (!activeApplicationId.value || sending.value || !canSend.value) return;

  const cleanText = String(text.value || "").trim();
  const file = fileList.value?.[0]?.raw || null;

  sending.value = true;
  try {
    let resp;
    if (file) {
      const fd = new FormData();
      if (cleanText) fd.append("text", cleanText);
      fd.append("document", file);
      resp = await apiClient.post(
        `/applications/${activeApplicationId.value}/chat/messages`,
        fd,
        { headers: { "Content-Type": "multipart/form-data" } },
      );
    } else {
      resp = await apiClient.post(
        `/applications/${activeApplicationId.value}/chat/messages`,
        { text: cleanText },
      );
    }

    if (resp?.data) {
      // Важно: используем общий путь добавления с дедупликацией по id,
      // т.к. сервер также рассылает это сообщение через socket.
      applyChatPreview(activeApplicationId.value, resp.data);
      pushIncomingMessage(activeApplicationId.value, resp.data);
    }

    text.value = "";
    clearFile();
    await scrollToBottom();
  } catch (err) {
    ElMessage.error(humanizeApiError(err, "Не удалось отправить"));
  } finally {
    sending.value = false;
  }
}

watch(
  () => route.query.appId,
  async (v) => {
    const id = parseInt(v, 10);
    if (Number.isFinite(id) && id !== activeApplicationId.value) {
      if (!chats.value.length) {
        await loadChats();
      }
      if (chats.value.some((c) => c.applicationId === id)) {
        await selectChatById(id);
      }
    }
  },
);

onMounted(async () => {
  if (auth.user) {
    applicationChats.connect({ userId: auth.user?.id });

    if (auth.user?.role === "admin" && auth.token && socket) {
      socket.emit("application_admin_subscribe", { token: auth.token });
    }

    await loadChats();
  }

  socket.on("application_chat_message", onSocketMessage);
});

onBeforeUnmount(() => {
  socket.off("application_chat_message", onSocketMessage);
  applicationChats.setActive(null);
});
</script>

<template>
  <div>
    <div class="section-head">
      <div>
        <div class="pill">Коммуникации</div>
        <h2 style="margin: 4px 0">Чаты заявок</h2>
        <div class="muted">Один чат на одну заявку.</div>
      </div>
      <el-button type="default" :loading="chatsLoading" @click="loadChats"
        >Обновить</el-button
      >
    </div>

    <div class="h-[calc(100vh-220px)] flex md:gap-6 mt-6">
      <!-- Chat List -->
      <div
        class="w-full md:w-1/3 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col"
      >
        <div class="p-4 border-b border-gray-100">
          <div class="font-bold text-gray-700">Заявки</div>
          <div style="margin-top: 10px; display: grid; gap: 8px">
            <el-input
              v-model="filterText"
              size="small"
              clearable
              placeholder="Поиск: № заявки, объект, агент..."
            />
            <el-checkbox v-model="onlyUnread" size="small"
              >Только непрочитанные</el-checkbox
            >
          </div>
        </div>
        <div class="overflow-y-auto flex-1">
          <div v-if="chatsLoading" class="p-4">
            <el-skeleton :rows="6" animated />
          </div>
          <div
            v-else-if="chats.length === 0"
            class="p-8 text-center text-gray-400 text-sm"
          >
            Пока нет чатов по заявкам
          </div>
          <div
            v-else
            v-for="chat in filteredChats"
            :key="chat.applicationId"
            @click="selectChat(chat)"
            class="p-4 border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition"
            :class="{
              'bg-blue-50 hover:bg-blue-50':
                activeApplicationId === chat.applicationId,
            }"
          >
            <div class="flex justify-between items-start mb-1">
              <div class="font-bold text-sm text-gray-900 truncate">
                {{ chatTitle(chat) }}
              </div>
              <div style="display: flex; gap: 8px; align-items: center">
                <el-tag
                  v-if="applicationChats.getUnread(chat.applicationId)"
                  size="small"
                  type="danger"
                  effect="dark"
                  round
                >
                  {{
                    applicationChats.getUnread(chat.applicationId) > 99
                      ? "99+"
                      : applicationChats.getUnread(chat.applicationId)
                  }}
                </el-tag>
                <div class="text-xs text-gray-400">
                  {{ formatTime(chat.lastTime) }}
                </div>
              </div>
            </div>
            <div v-if="isAdmin" class="text-xs text-gray-500 mb-1 truncate">
              Агент: {{ agentLabel(chat.agent) }}
            </div>
            <div class="text-sm text-gray-600 truncate">
              {{ chat.lastMessage || "—" }}
            </div>
            <div class="text-xs text-gray-400" style="margin-top: 4px">
              #{{ chat.applicationId }}
            </div>
          </div>
        </div>
      </div>

      <!-- Active Chat -->
      <div
        class="w-full md:flex-1 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col relative"
      >
        <div
          v-if="!activeApplicationId"
          class="flex-1 flex items-center justify-center text-gray-400"
        >
          Выберите заявку слева
        </div>
        <template v-else>
          <div
            class="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50"
          >
            <div class="overflow-hidden">
              <div class="font-bold text-sm truncate">
                {{
                  chatTitle(
                    chats.find((c) => c.applicationId === activeApplicationId),
                  )
                }}
              </div>
              <div class="text-xs text-gray-500 truncate">
                Заявка №{{ activeApplicationId }}
              </div>
            </div>
            <el-button
              type="default"
              plain
              :loading="messagesLoading"
              @click="loadMessages(activeApplicationId)"
            >
              Обновить
            </el-button>
          </div>

          <div
            ref="messagesContainer"
            class="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50/50"
          >
            <el-skeleton v-if="messagesLoading" :rows="6" animated />

            <el-empty
              v-else-if="!activeMessages.length"
              description="Сообщений пока нет"
            />

            <div
              v-else
              v-for="m in activeMessages"
              :key="m.id"
              class="flex flex-col gap-1"
            >
              <div
                class="max-w-[85%] p-3 rounded-2xl text-sm"
                :class="
                  isMine(m)
                    ? 'bg-blue-600 text-white self-end rounded-br-none'
                    : 'bg-white border border-gray-200 text-gray-800 self-start rounded-bl-none'
                "
              >
                <div v-if="m.text" style="white-space: pre-wrap">
                  {{ m.text }}
                </div>
                <div v-if="m.attachmentUrl" style="margin-top: 8px">
                  <a
                    :href="m.attachmentUrl"
                    target="_blank"
                    rel="noopener"
                    class="underline"
                    :class="isMine(m) ? 'text-white' : 'text-accent'"
                  >
                    {{ m.attachmentOriginalName || "Файл" }}
                  </a>
                </div>
              </div>
              <div
                class="text-[10px] text-gray-400"
                :class="isMine(m) ? 'self-end' : 'self-start'"
              >
                {{ formatDateTimeRu(m.createdAt) }}
              </div>
            </div>
          </div>

          <div class="p-4 border-t border-gray-100 bg-white">
            <div style="display: grid; gap: 10px">
              <el-input
                v-model="text"
                type="textarea"
                :rows="2"
                placeholder="Напишите сообщение..."
                @keyup.enter.exact.prevent="send"
              />

              <div
                style="
                  display: flex;
                  gap: 10px;
                  flex-wrap: wrap;
                  align-items: center;
                "
              >
                <el-upload
                  :auto-upload="false"
                  :file-list="fileList"
                  :limit="1"
                  :before-upload="beforeUpload"
                  :on-change="onFileChange"
                  accept=".pdf,.doc,.docx"
                >
                  <el-button type="default" plain>Прикрепить файл</el-button>
                </el-upload>

                <el-button
                  type="primary"
                  :loading="sending"
                  :disabled="!canSend"
                  @click="send"
                >
                  Отправить
                </el-button>

                <el-button
                  v-if="fileList.length"
                  type="default"
                  plain
                  @click="clearFile"
                >
                  Убрать файл
                </el-button>

                <div class="muted" style="font-size: 12px">
                  PDF/DOC/DOCX · до 15 МБ
                </div>
              </div>
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>
