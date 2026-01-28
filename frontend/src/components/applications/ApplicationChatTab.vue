<script setup>
import { computed, onMounted, ref, watch } from "vue";
import { ElMessage } from "element-plus";
import { apiClient } from "@/stores/auth";
import { humanizeApiError } from "@/utils/errors";
import { personName } from "@/utils/person";
import { formatDateTime } from "@/utils/datetime";

const props = defineProps({
  applicationId: { type: Number, required: true },
});

const loading = ref(false);
const sending = ref(false);
const messages = ref([]);
const text = ref("");
const fileList = ref([]);

const canSend = computed(() => {
  return Boolean(String(text.value || "").trim() || fileList.value.length);
});

function senderLabel(sender) {
  if (!sender) return "";
  return personName(sender) || sender.email || `#${sender.id}`;
}

async function load() {
  if (!props.applicationId) return;
  loading.value = true;
  try {
    const { data } = await apiClient.get(
      `/applications/${props.applicationId}/chat/messages`,
    );
    messages.value = Array.isArray(data) ? data : [];
  } catch (err) {
    ElMessage.error(humanizeApiError(err, "Не удалось загрузить чат"));
  } finally {
    loading.value = false;
  }
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
  // Keep only one file
  fileList.value = Array.isArray(uploadFiles) ? uploadFiles.slice(-1) : [];
}

function clearFile() {
  fileList.value = [];
}

async function send() {
  if (!props.applicationId || sending.value || !canSend.value) return;

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
        `/applications/${props.applicationId}/chat/messages`,
        fd,
        { headers: { "Content-Type": "multipart/form-data" } },
      );
    } else {
      resp = await apiClient.post(
        `/applications/${props.applicationId}/chat/messages`,
        { text: cleanText },
      );
    }

    if (resp?.data) {
      messages.value.push(resp.data);
    }

    text.value = "";
    clearFile();
  } catch (err) {
    ElMessage.error(humanizeApiError(err, "Не удалось отправить"));
  } finally {
    sending.value = false;
  }
}

watch(
  () => props.applicationId,
  () => load(),
  { immediate: true },
);

onMounted(() => load());
</script>

<template>
  <div>
    <div style="display: flex; justify-content: flex-end; margin-bottom: 10px">
      <el-button type="default" :loading="loading" @click="load">
        Обновить
      </el-button>
    </div>

    <el-skeleton v-if="loading" :rows="5" animated />

    <el-empty v-else-if="!messages.length" description="Сообщений пока нет" />

    <div v-else style="display: grid; gap: 10px">
      <div
        v-for="m in messages"
        :key="m.id"
        style="
          border: 1px solid var(--el-border-color-lighter);
          border-radius: 12px;
          padding: 12px;
          background: white;
        "
      >
        <div style="display: flex; justify-content: space-between; gap: 12px">
          <div style="font-weight: 700">
            {{ senderLabel(m.sender) }}
            <span class="muted" style="font-weight: 500">
              · {{ m.senderRole === "admin" ? "Администратор" : "Агент" }}
            </span>
          </div>
          <div class="muted">{{ formatDateTime(m.createdAt) }}</div>
        </div>

        <div v-if="m.text" style="margin-top: 6px; white-space: pre-wrap">
          {{ m.text }}
        </div>

        <div v-if="m.attachmentUrl" style="margin-top: 8px">
          <a
            :href="m.attachmentUrl"
            target="_blank"
            rel="noopener"
            class="text-accent underline"
          >
            {{ m.attachmentOriginalName || "Файл" }}
          </a>
          <span
            v-if="m.attachmentMimeType"
            class="muted"
            style="margin-left: 8px"
          >
            {{ m.attachmentMimeType }}
          </span>
        </div>
      </div>
    </div>

    <el-divider style="margin: 16px 0" />

    <div style="display: grid; gap: 10px">
      <el-input
        v-model="text"
        type="textarea"
        :rows="3"
        placeholder="Сообщение..."
      />

      <div
        style="display: flex; gap: 10px; flex-wrap: wrap; align-items: center"
      >
        <el-upload
          :auto-upload="false"
          :file-list="fileList"
          :limit="1"
          :before-upload="beforeUpload"
          :on-change="onFileChange"
          :on-exceed="() => ElMessage.warning('Можно прикрепить только 1 файл')"
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
      </div>

      <div class="muted" style="font-size: 12px">
        Разрешены форматы: PDF/DOC/DOCX. До 15 МБ.
      </div>
    </div>
  </div>
</template>
