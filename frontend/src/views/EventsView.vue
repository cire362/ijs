<script setup>
import { computed, onMounted, ref } from "vue";
import { useAuthStore, apiClient } from "../stores/auth";
import { ElMessage } from "element-plus";
import SearchCard from "@/components/ui/SearchCard.vue";
import { limits } from "@/utils/constraints";
import EventsCardsList from "@/components/events/EventsCardsList.vue";
import { normalizeText } from "@/utils/text";
import { formatDateTime } from "@/utils/datetime";

const auth = useAuthStore();

const items = ref([]);
const loading = ref(false);
const total = ref(0);
const page = ref(1);
const limit = ref(10);

const q = ref("");

const isAdmin = computed(() => auth.user?.role === "admin");
const isAgent = computed(() =>
  ["agent", "individual"].includes(auth.user?.role),
);

const calendarDate = ref(new Date());

const activeTab = ref("all");
const adminTab = ref("events");

const myRegistrations = ref([]);
const myTotal = ref(0);
const myPage = ref(1);
const myLimit = ref(10);
const myLoading = ref(false);

const createForm = ref({
  title: "",
  description: "",
  location: "",
  format: "offline",
  startAt: "",
  endAt: "",
  isTraining: true,
  capacity: "",
});

const coverFile = ref(null);

const creating = ref(false);

const registrations = ref([]);
const registrationsLoading = ref(false);
const selectedEventId = ref("");
const updatingRegId = ref(null);

const registrationsStats = computed(() => {
  const list = Array.isArray(registrations.value) ? registrations.value : [];
  const total = list.length;
  const by = { new: 0, approved: 0, rejected: 0 };
  for (const r of list) {
    if (!r?.status) continue;
    if (r.status === "new") by.new += 1;
    else if (r.status === "approved") by.approved += 1;
    else if (r.status === "rejected") by.rejected += 1;
  }
  const event = list[0]?.event || null;
  const capacity = event?.capacity == null ? null : Number(event.capacity);
  const remaining =
    capacity != null && Number.isFinite(capacity)
      ? Math.max(0, capacity - total)
      : null;
  return { total, ...by, event, capacity, remaining };
});

// normalizeText / formatDateTime вынесены в utils

function formatLabel(v) {
  if (v === "online") return "Онлайн";
  if (v === "hybrid") return "Гибрид";
  if (v === "offline") return "Офлайн";
  return "—";
}

function formatTagType(v) {
  if (v === "online") return "info";
  if (v === "hybrid") return "warning";
  if (v === "offline") return "success";
  return "default";
}

function onCoverChange(uploadFile) {
  coverFile.value = uploadFile?.raw || null;
}

function ymd(d) {
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return "";
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const filtered = computed(() => {
  const qq = normalizeText(q.value);
  if (!qq) return items.value;
  return items.value.filter((e) => {
    const hay = [e.title, e.description, e.location]
      .filter(Boolean)
      .map((x) => normalizeText(x))
      .join(" ");
    return hay.includes(qq);
  });
});

const trainingEvents = computed(() =>
  filtered.value.filter((e) => !!e.isTraining),
);

const eventsByDay = computed(() => {
  const map = new Map();
  for (const e of trainingEvents.value) {
    const key = ymd(e.startAt);
    if (!key) continue;
    const list = map.get(key) || [];
    list.push(e);
    map.set(key, list);
  }
  for (const [k, list] of map.entries()) {
    list.sort((a, b) => new Date(a.startAt) - new Date(b.startAt));
    map.set(k, list);
  }
  return map;
});

const selectedTrainingKey = computed(() => ymd(calendarDate.value));
const selectedTrainingEvents = computed(
  () => eventsByDay.value.get(selectedTrainingKey.value) || [],
);

async function load() {
  loading.value = true;
  try {
    const { data } = await apiClient.get("/events", {
      params: {
        q: q.value || "",
        page: page.value,
        limit: limit.value,
      },
    });
    if (Array.isArray(data)) {
      items.value = data;
      total.value = data.length;
    } else {
      items.value = Array.isArray(data?.items) ? data.items : [];
      total.value = Number.isFinite(Number(data?.total))
        ? Number(data.total)
        : items.value.length;
    }
  } catch (err) {
    ElMessage.error(
      err.response?.data?.error || "Не удалось загрузить мероприятия",
    );
  } finally {
    loading.value = false;
  }
}

async function loadMy() {
  if (!isAgent.value) return;
  myLoading.value = true;
  try {
    const { data } = await apiClient.get("/events/my", {
      params: {
        page: myPage.value,
        limit: myLimit.value,
      },
    });
    myRegistrations.value = Array.isArray(data?.items) ? data.items : [];
    myTotal.value = Number.isFinite(Number(data?.total))
      ? Number(data.total)
      : myRegistrations.value.length;
  } catch (err) {
    myRegistrations.value = [];
    myTotal.value = 0;
    ElMessage.error(
      err.response?.data?.error || "Не удалось загрузить мои мероприятия",
    );
  } finally {
    myLoading.value = false;
  }
}

async function loadRegistrations() {
  if (!isAdmin.value) return;
  registrationsLoading.value = true;
  try {
    const params = {};
    if (selectedEventId.value) params.eventId = selectedEventId.value;
    const { data } = await apiClient.get("/events/registrations", { params });
    registrations.value = Array.isArray(data) ? data : [];
  } catch (err) {
    registrations.value = [];
  } finally {
    registrationsLoading.value = false;
  }
}

async function onChangeSelectedEvent() {
  await loadRegistrations();
}

async function createEvent() {
  if (!isAdmin.value) return;
  if (!String(createForm.value.title || "").trim()) {
    ElMessage.error("Укажите название");
    return;
  }
  if (!createForm.value.startAt) {
    ElMessage.error("Укажите дату и время начала");
    return;
  }

  creating.value = true;
  try {
    const payload = {
      title: createForm.value.title,
      description: createForm.value.description,
      location: createForm.value.location,
      format: createForm.value.format,
      startAt: createForm.value.startAt,
      endAt: createForm.value.endAt || null,
      isTraining: !!createForm.value.isTraining,
      capacity: createForm.value.capacity,
    };
    const { data: created } = await apiClient.post("/events", payload);

    if (coverFile.value && created?.id) {
      const fd = new FormData();
      fd.append("image", coverFile.value);
      await apiClient.post(`/events/${created.id}/image`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
    }

    createForm.value = {
      title: "",
      description: "",
      location: "",
      format: "offline",
      startAt: "",
      endAt: "",
      isTraining: true,
      capacity: "",
    };

    coverFile.value = null;

    ElMessage.success("Мероприятие создано");
    await load();
  } catch (err) {
    ElMessage.error(err.response?.data?.error || "Не удалось создать");
  } finally {
    creating.value = false;
  }
}

async function registerForEvent(e) {
  if (!isAgent.value) return;
  try {
    await apiClient.post(`/events/${e.id}/register`);
    ElMessage.success("Запись отправлена администратору");
    if (isAdmin.value) await loadRegistrations();
    await loadMy();
  } catch (err) {
    ElMessage.error(err.response?.data?.error || "Не удалось записаться");
  }
}

async function setRegistrationStatus(row, status) {
  if (!isAdmin.value) return;
  if (!row?.id) return;
  updatingRegId.value = row.id;
  try {
    await apiClient.patch(`/events/registrations/${row.id}`, { status });
    ElMessage.success(
      status === "approved" ? "Заявка подтверждена" : "Заявка отклонена",
    );
    await loadRegistrations();
  } catch (err) {
    ElMessage.error(err.response?.data?.error || "Не удалось обновить заявку");
  } finally {
    updatingRegId.value = null;
  }
}

function trainingCountForCell(date) {
  const key = ymd(date);
  const list = eventsByDay.value.get(key) || [];
  return list.length;
}

function selectCalendarDay(date) {
  if (!date) return;
  calendarDate.value = date instanceof Date ? date : new Date(date);
}

onMounted(async () => {
  await load();
  await loadRegistrations();
  await loadMy();
});
</script>

<template>
  <div>
    <div class="section-head">
      <div>
        <div class="pill">Мероприятия</div>
        <h2 style="margin: 4px 0">Мероприятия</h2>
        <div class="muted">Обучения и события</div>
      </div>
      <el-button @click="load" :loading="loading" type="default"
        >Обновить</el-button
      >
    </div>

    <el-tabs
      v-if="isAdmin"
      v-model="adminTab"
      style="margin-bottom: var(--gap-md)"
    >
      <el-tab-pane label="Мероприятия" name="events">
        <el-card shadow="never" style="margin-bottom: var(--gap-md)">
          <div class="muted" style="margin-bottom: 8px">
            Создать мероприятие
          </div>
          <el-form label-position="top">
            <el-form-item label="Название">
              <el-input
                v-model="createForm.title"
                :maxlength="limits.events.title"
              />
            </el-form-item>
            <el-form-item label="Описание (опционально)">
              <el-input
                v-model="createForm.description"
                type="textarea"
                :rows="3"
                :maxlength="limits.events.description"
              />
            </el-form-item>
            <el-form-item label="Место (опционально)">
              <el-input
                v-model="createForm.location"
                :maxlength="limits.events.location"
              />
            </el-form-item>

            <div style="display: flex; gap: var(--gap-md); flex-wrap: wrap">
              <el-form-item label="Формат" style="min-width: 220px">
                <el-select v-model="createForm.format" style="width: 100%">
                  <el-option label="Офлайн" value="offline" />
                  <el-option label="Онлайн (удалённо)" value="online" />
                  <el-option label="Гибрид" value="hybrid" />
                </el-select>
              </el-form-item>

              <el-form-item
                label="Обложка (опционально)"
                style="min-width: 320px"
              >
                <el-upload
                  :auto-upload="false"
                  :limit="1"
                  accept="image/png,image/jpeg,image/webp"
                  :on-change="onCoverChange"
                >
                  <el-button type="default">Выбрать картинку</el-button>
                </el-upload>
              </el-form-item>
            </div>

            <div style="display: flex; gap: var(--gap-md); flex-wrap: wrap">
              <el-form-item label="Начало" style="min-width: 260px">
                <el-date-picker
                  v-model="createForm.startAt"
                  type="datetime"
                  value-format="YYYY-MM-DDTHH:mm:ss.SSSZ"
                />
              </el-form-item>
              <el-form-item
                label="Окончание (опционально)"
                style="min-width: 260px"
              >
                <el-date-picker
                  v-model="createForm.endAt"
                  type="datetime"
                  value-format="YYYY-MM-DDTHH:mm:ss.SSSZ"
                />
              </el-form-item>
              <el-form-item
                label="Лимит мест (опционально)"
                style="min-width: 200px"
              >
                <el-input
                  v-model="createForm.capacity"
                  placeholder="например, 30"
                />
              </el-form-item>
            </div>

            <div
              style="
                display: flex;
                gap: var(--gap-sm);
                align-items: center;
                flex-wrap: wrap;
              "
            >
              <el-switch
                v-model="createForm.isTraining"
                active-text="Обучающее"
                inactive-text="Обычное"
              />
              <el-button type="primary" :loading="creating" @click="createEvent"
                >Создать</el-button
              >
            </div>
          </el-form>
        </el-card>

        <SearchCard
          v-model:q="q"
          :count="total"
          placeholder="Поиск по названию/описанию/месту"
          @input="
            () => {
              page.value = 1;
              load();
            }
          "
        />

        <EventsCardsList
          :events="filtered"
          :loading="loading"
          emptyText="Мероприятий пока нет"
          :formatDateTime="formatDateTime"
          :formatLabel="formatLabel"
          :formatTagType="formatTagType"
        />

        <div
          v-if="total > limit"
          style="display: flex; justify-content: flex-end"
        >
          <el-pagination
            background
            layout="prev, pager, next"
            :total="total"
            :page-size="limit"
            :current-page="page"
            @current-change="
              (p) => {
                page.value = p;
                load();
              }
            "
          />
        </div>
      </el-tab-pane>

      <el-tab-pane label="Заявки" name="requests">
        <el-card shadow="never">
          <div class="muted" style="margin-bottom: 8px">
            Заявки на мероприятия (входящие)
          </div>

          <div
            style="
              display: flex;
              gap: var(--gap-md);
              align-items: flex-end;
              flex-wrap: wrap;
              margin-bottom: 10px;
            "
          >
            <div style="min-width: 320px">
              <div class="muted" style="margin-bottom: 6px">Мероприятие</div>
              <el-select
                v-model="selectedEventId"
                filterable
                clearable
                placeholder="Все мероприятия"
                style="width: 100%"
                @change="onChangeSelectedEvent"
                @clear="onChangeSelectedEvent"
              >
                <el-option
                  v-for="e in filtered"
                  :key="e.id"
                  :label="`${e.title} — ${formatDateTime(e.startAt)}`"
                  :value="String(e.id)"
                />
              </el-select>
            </div>

            <el-button
              type="default"
              @click="loadRegistrations"
              :loading="registrationsLoading"
              >Обновить заявки</el-button
            >
          </div>

          <el-card shadow="never" style="margin-bottom: 10px">
            <div
              style="
                display: flex;
                gap: 10px;
                flex-wrap: wrap;
                align-items: center;
              "
            >
              <el-tag effect="light" type="info"
                >Всего: {{ registrationsStats.total }}</el-tag
              >
              <el-tag effect="light" type="warning"
                >Новые: {{ registrationsStats.new }}</el-tag
              >
              <el-tag effect="light" type="success"
                >Подтверждены: {{ registrationsStats.approved }}</el-tag
              >
              <el-tag effect="light" type="danger"
                >Отклонены: {{ registrationsStats.rejected }}</el-tag
              >
              <el-tag
                v-if="registrationsStats.capacity != null"
                effect="light"
                type="primary"
              >
                Лимит: {{ registrationsStats.capacity }}
              </el-tag>
              <el-tag
                v-if="registrationsStats.remaining != null"
                effect="light"
                type="primary"
              >
                Осталось: {{ registrationsStats.remaining }}
              </el-tag>
            </div>
          </el-card>

          <el-table
            :data="registrations"
            v-loading="registrationsLoading"
            border
          >
            <el-table-column prop="createdAt" label="Дата" width="180">
              <template #default="scope">
                {{ formatDateTime(scope.row.createdAt) }}
              </template>
            </el-table-column>
            <el-table-column
              prop="event.title"
              label="Мероприятие"
              min-width="220"
            >
              <template #default="scope">
                {{ scope.row.event?.title || "—" }}
              </template>
            </el-table-column>
            <el-table-column prop="event.format" label="Формат" width="120">
              <template #default="scope">
                <el-tag
                  v-if="scope.row.event?.format"
                  :type="formatTagType(scope.row.event?.format)"
                  effect="light"
                >
                  {{ formatLabel(scope.row.event?.format) }}
                </el-tag>
                <span v-else>—</span>
              </template>
            </el-table-column>
            <el-table-column prop="agent" label="Агент" min-width="220">
              <template #default="scope">
                {{
                  [
                    scope.row.agent?.lastName,
                    scope.row.agent?.firstName,
                    scope.row.agent?.middleName,
                  ]
                    .filter(Boolean)
                    .join(" ") ||
                  scope.row.agent?.email ||
                  "—"
                }}
              </template>
            </el-table-column>
            <el-table-column prop="status" label="Статус" width="120">
              <template #default="scope">
                <el-tag
                  :type="
                    scope.row.status === 'new'
                      ? 'warning'
                      : scope.row.status === 'approved'
                        ? 'success'
                        : 'danger'
                  "
                  effect="light"
                >
                  {{
                    scope.row.status === "new"
                      ? "Новая"
                      : scope.row.status === "approved"
                        ? "Подтверждена"
                        : "Отклонена"
                  }}
                </el-tag>
              </template>
            </el-table-column>

            <el-table-column label="Действия" width="220">
              <template #default="scope">
                <div style="display: flex; gap: 8px; flex-wrap: wrap">
                  <el-button
                    size="small"
                    type="success"
                    :disabled="scope.row.status !== 'new'"
                    :loading="updatingRegId === scope.row.id"
                    @click="setRegistrationStatus(scope.row, 'approved')"
                  >
                    Подтвердить
                  </el-button>
                  <el-button
                    size="small"
                    type="danger"
                    :disabled="scope.row.status !== 'new'"
                    :loading="updatingRegId === scope.row.id"
                    @click="setRegistrationStatus(scope.row, 'rejected')"
                  >
                    Отклонить
                  </el-button>
                </div>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-tab-pane>
    </el-tabs>

    <el-card
      v-if="isAgent"
      shadow="never"
      style="margin-bottom: var(--gap-md)"
      class="events-calendar"
    >
      <div class="muted" style="margin-bottom: 8px">
        Календарь обучающих мероприятий
      </div>
      <el-calendar v-model="calendarDate">
        <template #date-cell="{ data }">
          <div
            class="cal-cell"
            @click.stop.prevent="selectCalendarDay(data.date)"
          >
            <div class="cal-cell-head">
              <div class="cal-day-wrap">
                <span
                  class="cal-day"
                  :class="data.isSelected ? 'is-selected' : ''"
                  >{{ data.day.split("-").slice(2).join("") }}</span
                >
                <el-tag
                  v-if="trainingCountForCell(data.date)"
                  size="small"
                  type="success"
                  effect="light"
                  class="cal-count"
                >
                  {{ trainingCountForCell(data.date) }}
                </el-tag>
              </div>
            </div>
          </div>
        </template>
      </el-calendar>

      <div class="cal-agenda">
        <div class="muted" style="margin: 10px 0 6px">
          События на {{ selectedTrainingKey }}
        </div>

        <div
          class="cal-agenda-empty muted"
          v-if="!selectedTrainingEvents.length"
        >
          На выбранную дату мероприятий нет.
        </div>

        <div class="cal-agenda-list" v-else>
          <div
            v-for="e in selectedTrainingEvents"
            :key="e.id"
            class="cal-agenda-item"
          >
            <div class="cal-agenda-title">{{ e.title }}</div>
            <div class="muted cal-agenda-meta">
              {{ formatDateTime(e.startAt) }}
              <template v-if="e.location"> · {{ e.location }}</template>
            </div>
          </div>
        </div>
      </div>
    </el-card>

    <el-tabs
      v-if="isAgent"
      v-model="activeTab"
      style="margin-bottom: var(--gap-md)"
    >
      <el-tab-pane label="Все мероприятия" name="all">
        <SearchCard
          v-model:q="q"
          :count="total"
          placeholder="Поиск по названию/описанию/месту"
          @input="
            () => {
              page.value = 1;
              load();
            }
          "
        />

        <EventsCardsList
          :events="filtered"
          :loading="loading"
          emptyText="Мероприятий пока нет"
          :formatDateTime="formatDateTime"
          :formatLabel="formatLabel"
          :formatTagType="formatTagType"
        >
          <template #actions="{ event: e }">
            <el-button
              v-if="isAgent"
              type="primary"
              @click="registerForEvent(e)"
            >
              Записаться
            </el-button>
          </template>
        </EventsCardsList>

        <div
          v-if="total > limit"
          style="display: flex; justify-content: flex-end"
        >
          <el-pagination
            background
            layout="prev, pager, next"
            :total="total"
            :page-size="limit"
            :current-page="page"
            @current-change="
              (p) => {
                page = p;
                load();
              }
            "
          />
        </div>
      </el-tab-pane>

      <el-tab-pane label="Мои мероприятия" name="my">
        <el-card shadow="never">
          <div class="muted" style="margin-bottom: 8px">
            Мои записи на мероприятия
          </div>
          <el-table :data="myRegistrations" v-loading="myLoading" border>
            <el-table-column prop="createdAt" label="Дата записи" width="180">
              <template #default="scope">
                {{ formatDateTime(scope.row.createdAt) }}
              </template>
            </el-table-column>
            <el-table-column
              prop="event.title"
              label="Мероприятие"
              min-width="220"
            >
              <template #default="scope">
                {{ scope.row.event?.title || "—" }}
              </template>
            </el-table-column>
            <el-table-column prop="event.startAt" label="Начало" width="180">
              <template #default="scope">
                {{ formatDateTime(scope.row.event?.startAt) }}
              </template>
            </el-table-column>
            <el-table-column prop="event.format" label="Формат" width="120">
              <template #default="scope">
                <el-tag
                  v-if="scope.row.event?.format"
                  :type="formatTagType(scope.row.event?.format)"
                  effect="light"
                >
                  {{ formatLabel(scope.row.event?.format) }}
                </el-tag>
                <span v-else>—</span>
              </template>
            </el-table-column>
            <el-table-column prop="status" label="Статус" width="140">
              <template #default="scope">
                <el-tag
                  :type="
                    scope.row.status === 'new'
                      ? 'warning'
                      : scope.row.status === 'approved'
                        ? 'success'
                        : 'danger'
                  "
                  effect="light"
                >
                  {{
                    scope.row.status === "new"
                      ? "Новая"
                      : scope.row.status === "approved"
                        ? "Подтверждена"
                        : "Отклонена"
                  }}
                </el-tag>
              </template>
            </el-table-column>
          </el-table>

          <div
            style="
              margin-top: 10px;
              display: flex;
              justify-content: space-between;
              gap: 8px;
              flex-wrap: wrap;
            "
          >
            <el-button type="default" @click="loadMy" :loading="myLoading"
              >Обновить</el-button
            >
            <el-pagination
              v-if="myTotal > myLimit"
              background
              layout="prev, pager, next"
              :total="myTotal"
              :page-size="myLimit"
              :current-page="myPage"
              @current-change="
                (p) => {
                  myPage.value = p;
                  loadMy();
                }
              "
            />
          </div>
        </el-card>
      </el-tab-pane>
    </el-tabs>

    <template v-if="!isAdmin && !isAgent">
      <SearchCard
        v-model:q="q"
        :count="total"
        placeholder="Поиск по названию/описанию/месту"
        @input="
          () => {
            page.value = 1;
            load();
          }
        "
      />

      <EventsCardsList
        :events="filtered"
        :loading="loading"
        emptyText="Мероприятий пока нет"
        :formatDateTime="formatDateTime"
        :formatLabel="formatLabel"
        :formatTagType="formatTagType"
      />

      <div
        v-if="total > limit"
        style="display: flex; justify-content: flex-end"
      >
        <el-pagination
          background
          layout="prev, pager, next"
          :total="total"
          :page-size="limit"
          :current-page="page"
          @current-change="
            (p) => {
              page = p;
              load();
            }
          "
        />
      </div>
    </template>
  </div>
</template>

<style scoped>
.is-selected {
  font-weight: 700;
}

.cal-cell {
  display: grid;
  gap: 4px;
  cursor: pointer;
}

.cal-cell-head {
  display: flex;
  align-items: flex-start;
}

.cal-day-wrap {
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: flex-start;
}

/* Element Plus calendar tweaks */
.events-calendar :deep(.el-calendar__header) {
  flex-wrap: wrap;
  gap: 8px;
}

.events-calendar :deep(.el-calendar__title) {
  font-size: 14px;
  line-height: 1.2;
}

.events-calendar :deep(.el-calendar__button-group) {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.events-calendar :deep(.el-calendar__button-group .el-button) {
  padding: 6px 10px;
}

.events-calendar :deep(.el-calendar-table .el-calendar-day) {
  padding: 8px;
}

/* Mobile: keep cells compact, show agenda list below */
@media (max-width: 480px) {
  .events-calendar :deep(.el-calendar-table .el-calendar-day) {
    padding: 6px;
  }

  .events-calendar :deep(.el-calendar-table td) {
    vertical-align: top;
  }
}

.cal-agenda {
  margin-top: 8px;
}

.cal-agenda-list {
  display: grid;
  gap: 10px;
}

.cal-agenda-item {
  padding: 10px 12px;
  border: 1px solid #e7e7e7;
  border-radius: 12px;
  background: #fff;
}

.cal-agenda-title {
  font-weight: 700;
  font-size: 14px;
  line-height: 1.2;
}

.cal-agenda-meta {
  margin-top: 4px;
  font-size: 12px;
}

.cal-agenda-empty {
  padding: 8px 0;
}
</style>
