<script setup>
import { computed, onMounted, ref, watch } from "vue";
import { useAuthStore } from "../stores/auth";
import { ElMessage } from "element-plus";
import { useNotificationsStore } from "@/stores/notifications";

const auth = useAuthStore();
const notifications = useNotificationsStore();

const typeFilter = ref("");
const readFilter = ref("all"); // all | unread | read
const q = ref("");

const loading = computed(() => notifications.loading);
const items = computed(() => notifications.items);

const TYPE_LABELS = {
  application_new: "Новая заявка",
  application_status: "Статус заявки (агент)",
  application_status_changed: "Изменение статуса заявки",
  developer_registration: "Новая регистрация застройщика",
  developer_status: "Статус регистрации застройщика",
  event_registration: "Заявка на мероприятие",
  event_registration_status: "Статус заявки на мероприятие",
  event_reminder: "Напоминание о мероприятии",
};

function typeLabel(type) {
  if (!type) return "Уведомление";
  return TYPE_LABELS[type] || type;
}

const typeOptions = computed(() => {
  const set = new Set();
  for (const n of items.value || []) {
    if (n?.type) set.add(n.type);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
});

function buildParams() {
  const params = {};
  if (typeFilter.value) params.type = typeFilter.value;
  if (q.value && String(q.value).trim()) params.q = String(q.value).trim();
  if (readFilter.value === "unread") params.isRead = false;
  if (readFilter.value === "read") params.isRead = true;
  params.page = notifications.page;
  params.limit = notifications.limit;
  return params;
}

async function onFiltersChanged() {
  notifications.page = 1;
  await load();
}

async function load() {
  if (!auth.user) return;
  try {
    await notifications.load(buildParams());
  } catch (err) {
    ElMessage.error(err.response?.data?.error || "Не удалось загрузить");
  }
}

async function markRead(id) {
  try {
    await notifications.markRead(id);
    ElMessage.success("Отмечено как прочитано");
  } catch (err) {
    ElMessage.error(err.response?.data?.error || "Не удалось обновить");
  }
}

onMounted(async () => {
  if (auth.user) {
    await load();
    await notifications.refreshUnreadCount();
  }
});

watch(
  () => auth.user?.id,
  async (id) => {
    if (id) {
      await load();
      await notifications.refreshUnreadCount();
    }
  }
);
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
          <div
            style="
              display: flex;
              gap: var(--gap-md);
              flex-wrap: wrap;
              margin-bottom: 12px;
            "
          >
            <div style="min-width: 240px">
              <div class="muted" style="margin-bottom: 6px">Тип</div>
              <el-select
                v-model="typeFilter"
                clearable
                placeholder="Все"
                style="width: 100%"
                @change="onFiltersChanged"
                @clear="onFiltersChanged"
              >
                <el-option
                  v-for="t in typeOptions"
                  :key="t"
                  :label="typeLabel(t)"
                  :value="t"
                />
              </el-select>
            </div>
            <div style="min-width: 200px">
              <div class="muted" style="margin-bottom: 6px">Статус</div>
              <el-select
                v-model="readFilter"
                style="width: 100%"
                @change="onFiltersChanged"
              >
                <el-option label="Все" value="all" />
                <el-option label="Только новые" value="unread" />
                <el-option label="Только прочитанные" value="read" />
              </el-select>
            </div>
            <div style="min-width: 280px; flex: 1">
              <div class="muted" style="margin-bottom: 6px">Поиск</div>
              <el-input
                v-model="q"
                clearable
                placeholder="Поиск по тексту"
                @input="onFiltersChanged"
              />
            </div>
          </div>

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
                    <div class="pill">{{ typeLabel(n.type) }}</div>
                    <div style="font-weight: 700; margin-top: 6px">
                      {{ n.text }}
                    </div>
                  </div>
                  <el-tag
                    v-if="!n.isRead"
                    type="success"
                    size="small"
                    style="margin-top: 18px"
                    >Новое</el-tag
                  >
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

          <div
            style="display: flex; justify-content: flex-end; margin-top: 12px"
          >
            <el-pagination
              v-if="notifications.total > notifications.limit"
              v-model:current-page="notifications.page"
              v-model:page-size="notifications.limit"
              :total="notifications.total"
              layout="prev, pager, next"
              @current-change="load"
              @size-change="onFiltersChanged"
            />
          </div>
        </el-card>
      </div>
    </template>
  </div>
</template>
