<script setup>
import { onMounted, onBeforeUnmount, ref, watch } from "vue";
import { apiClient, useAuthStore } from "../stores/auth";
import { ElMessage } from "element-plus";
import { getSocket } from "@/utils/socket";

const auth = useAuthStore();
const items = ref([]);
const loading = ref(false);
let socket;

onMounted(() => {
  if (auth.user) {
    subscribeSocket();
    load();
  }
});

watch(
  () => auth.user?.id,
  (id) => {
    if (id) {
      subscribeSocket();
      load();
    } else {
      teardownSocket();
    }
  }
);

onBeforeUnmount(teardownSocket);

function subscribeSocket() {
  socket = getSocket();
  socket.emit("subscribe", auth.user.id);
  socket.off("notification", handleIncoming);
  socket.on("notification", handleIncoming);
}

function teardownSocket() {
  if (socket) {
    socket.off("notification", handleIncoming);
  }
}

function handleIncoming(note) {
  // Prepend live notifications for quick testing
  items.value = [note, ...items.value];
}

async function load() {
  loading.value = true;
  try {
    const { data } = await apiClient.get("/notifications");
    items.value = data;
  } catch (err) {
    ElMessage.error(err.response?.data?.error || "Не удалось загрузить");
  } finally {
    loading.value = false;
  }
}

async function markRead(id) {
  try {
    await apiClient.post(`/notifications/${id}/read`);
    ElMessage.success("Отмечено как прочитано");
    await load();
  } catch (err) {
    ElMessage.error(err.response?.data?.error || "Не удалось обновить");
  }
}
</script>

<template>
  <div>
    <div class="section-head">
      <div>
        <div class="pill">Лента событий</div>
        <h2 style="margin: 4px 0">Уведомления</h2>
        <div class="muted">Вся активность по объектам и заявкам.</div>
      </div>
      <el-button @click="load" :loading="loading" type="default"
        >Обновить</el-button
      >
    </div>
    <el-empty
      v-if="!auth.user"
      description="Авторизуйтесь, чтобы видеть уведомления"
    />
    <template v-else>
      <div v-loading="loading" style="min-height: 200px">
        <el-card shadow="never">
          <el-timeline>
            <el-timeline-item
              v-for="n in items"
              :key="n.id"
              :timestamp="new Date(n.createdAt).toLocaleString()"
              placement="top"
            >
              <el-card class="lift-hover" shadow="hover">
                <div
                  class="section-head"
                  style="margin-bottom: 8px; gap: var(--gap-sm)"
                >
                  <div>
                    <div class="pill">{{ n.type || "Уведомление" }}</div>
                    <div style="font-weight: 700; margin-top: 6px">
                      {{ n.text }}
                    </div>
                  </div>
                  <el-badge v-if="!n.isRead" value="Новое" type="success" />
                  <el-tag v-else type="info" size="small">Прочитано</el-tag>
                </div>
                <el-button
                  v-if="!n.isRead"
                  type="primary"
                  size="small"
                  @click="markRead(n.id)"
                  plain
                >
                  Отметить прочитанным
                </el-button>
              </el-card>
            </el-timeline-item>
          </el-timeline>
        </el-card>
      </div>
    </template>
  </div>
</template>
