<script setup>
import { computed, onMounted, ref, watch } from "vue";
import { useAuthStore, apiClient } from "../stores/auth";
import { ElMessage } from "element-plus";
import CRMTable from "@/components/ui/CRMTable.vue";
import {
  UploadFilled,
  CircleCheckFilled,
  DocumentChecked,
  Clock,
  Coin,
  Finished,
  CircleCloseFilled,
} from "@element-plus/icons-vue";

const auth = useAuthStore();
const items = ref([]);
const loading = ref(false);

const isManager = computed(
  () => auth.user?.role === "developer" || auth.user?.role === "admin"
);
const isAdmin = computed(() => auth.user?.role === "admin");

const selectedDeveloperId = ref("");
const developerOptions = ref([]);
const developerLoading = ref(false);
const q = ref("");
const selectedStatus = ref("");
const statusOptions = [
  { value: "confirmed", label: "Заявка подтверждена", type: "success" },
  { value: "contract_signed", label: "Договор заключен", type: "warning" },
  { value: "awaiting_payment", label: "Ожидание оплаты", type: "warning" },
  {
    value: "commission_available",
    label: "Комиссия доступна",
    type: "success",
  },
  { value: "done", label: "Завершено", type: "success" },
  { value: "rejected", label: "Отклонена", type: "danger" },
];

const STATUS_FLOW = [
  { key: "sent", label: "Заявка отправлена", icon: UploadFilled },
  { key: "confirmed", label: "Заявка подтверждена", icon: CircleCheckFilled },
  { key: "contract_signed", label: "Договор заключен", icon: DocumentChecked },
  { key: "awaiting_payment", label: "Ожидание оплаты", icon: Clock },
  { key: "commission_available", label: "Комиссия доступна", icon: Coin },
  { key: "done", label: "Завершено", icon: Finished },
];

const columns = computed(() => {
  const base = [
    { prop: "date", label: "Дата", minWidth: 120 },
    { prop: "number", label: "№", width: 80 },
    { prop: "title", label: "Название", minWidth: 180 },
    { prop: "address", label: "Адрес", minWidth: 220 },
    { prop: "price", label: "Стоимость", minWidth: 130 },
    { prop: "commission", label: "Комиссия", minWidth: 130 },
    { prop: "agentFio", label: "ФИО", minWidth: 180 },
    { prop: "deadline", label: "Срок до", minWidth: 130 },
    { prop: "status", label: "Статус", minWidth: 140 },
  ];
  if (isAdmin.value) {
    base.splice(7, 0, {
      prop: "developer",
      label: "Застройщик",
      minWidth: 200,
    });
  }
  return base;
});

function personName(u) {
  if (!u) return "";
  return (
    u.fullName ||
    [u.lastName, u.firstName, u.middleName].filter(Boolean).join(" ") ||
    u.name ||
    ""
  );
}

function developerLabel(d) {
  if (!d) return "";
  return d.companyName || personName(d) || d.email || `#${d.id}`;
}

function formatMoney(v) {
  if (v == null || v === "") return "—";
  const n = Number(v);
  if (Number.isNaN(n)) return "—";
  return `${n.toLocaleString()} ₽`;
}

function formatDate(v) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("ru-RU");
}

function formatDateTime(v) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("ru-RU");
}

function deadlineTagType(row) {
  const dt = row?.expiresAt ? new Date(row.expiresAt) : null;
  if (!dt || Number.isNaN(dt.getTime())) return "info";
  const diffMs = dt.getTime() - Date.now();
  if (diffMs <= 0) return "danger";
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  if (diffDays <= 2) return "warning";
  return "success";
}

function statusLabel(status) {
  const found = STATUS_FLOW.find((s) => s.key === status);
  if (found) return found.label;
  if (status === "rejected") return "Отклонена";
  if (status === "expired") return "Истек срок";
  return status || "—";
}

function statusActiveIndex(status) {
  if (status === "rejected" || status === "expired") return 1;
  const idx = STATUS_FLOW.findIndex((s) => s.key === status);
  return idx >= 0 ? idx + 1 : 1;
}

const selectedId = ref(null);
const selected = computed(() =>
  selectedId.value ? items.value.find((a) => a.id === selectedId.value) : null
);

const selectedHistory = computed(() => {
  const h = selected.value?.history;
  if (!Array.isArray(h)) return [];
  return [...h].sort((a, b) => {
    const ta = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
    const tb = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
    return ta - tb;
  });
});

function selectForTracking(id) {
  selectedId.value = id;
}

async function searchDevelopers(query) {
  developerLoading.value = true;
  try {
    const { data } = await apiClient.get("/users/developers", {
      params: { q: query || "" },
    });
    developerOptions.value = Array.isArray(data) ? data : [];
  } catch (err) {
    developerOptions.value = [];
  } finally {
    developerLoading.value = false;
  }
}

onMounted(() => {
  if (isManager.value) load();
});

async function load() {
  loading.value = true;
  try {
    const params = {};
    if (isAdmin.value && selectedDeveloperId.value) {
      params.developerId = selectedDeveloperId.value;
    }
    const { data } = await apiClient.get("/applications/incoming", { params });
    items.value = data;
  } catch (err) {
    ElMessage.error(err.response?.data?.error || "Не удалось загрузить");
  } finally {
    loading.value = false;
  }
}

async function updateStatus(id, status) {
  try {
    await apiClient.patch(`/applications/${id}/status`, { status });
    ElMessage.success("Статус обновлен");
    await load();
  } catch (err) {
    ElMessage.error(err.response?.data?.error || "Не удалось обновить статус");
  }
}

async function extendDeadline(id) {
  try {
    await apiClient.patch(`/applications/${id}/extend`, { days: 7 });
    ElMessage.success("Срок продлен на 7 дней");
    await load();
  } catch (err) {
    ElMessage.error(err.response?.data?.error || "Не удалось продлить срок");
  }
}

function statusTag(status) {
  if (status === "done") return "success";
  if (status === "commission_available") return "success";
  if (status === "rejected") return "danger";
  if (status === "expired") return "danger";
  if (status === "awaiting_payment" || status === "contract_signed")
    return "warning";
  return "info";
}

function normalizeText(v) {
  return String(v || "")
    .toLowerCase()
    .trim();
}

const filteredItems = computed(() => {
  const qq = normalizeText(q.value);
  return items.value.filter((a) => {
    if (selectedStatus.value && a.status !== selectedStatus.value) return false;
    if (!qq) return true;

    const p = a.property;
    const hay = [
      a.id,
      p?.title,
      p?.region,
      p?.city,
      p?.street,
      p?.plotNumber,
      personName(a.agent),
      developerLabel(p?.developer),
    ]
      .filter(Boolean)
      .map((x) => normalizeText(x))
      .join(" ");

    return hay.includes(qq);
  });
});

const page = ref(1);
const pageSize = ref(5);

watch(
  () => pageSize.value,
  (v) => {
    if (typeof v === "number" && v < 5) pageSize.value = 5;
  }
);

const tableRows = computed(() =>
  filteredItems.value.map((a) => ({
    ...a,
    date: formatDate(a.createdAt),
    number: a.id,
    title: a.property?.title,
    address: [
      a.property?.region,
      a.property?.city,
      a.property?.street,
      a.property?.plotNumber,
    ]
      .filter(Boolean)
      .join(", "),
    price: formatMoney(a.property?.price),
    commission: formatMoney(a.commissionAmount),
    developer: developerLabel(a.property?.developer),
    agentFio: personName(a.agent),
    deadline: a.expiresAt,
  }))
);

watch(
  () => tableRows.value.length,
  () => {
    page.value = 1;
  }
);

const pagedRows = computed(() => {
  const start = (page.value - 1) * pageSize.value;
  return tableRows.value.slice(start, start + pageSize.value);
});
</script>

<template>
  <div>
    <div class="section-head">
      <div>
        <div class="pill">Поток заявок</div>
        <h2 style="margin: 4px 0">Входящие</h2>
        <div class="muted">
          Статусы заявок от агентов — быстро меняйте статус.
        </div>
      </div>
      <el-button @click="load" :loading="loading" type="default"
        >Обновить</el-button
      >
    </div>

    <el-card v-if="isAdmin" shadow="never" style="margin-bottom: var(--gap-md)">
      <div class="muted" style="margin-bottom: 8px">Застройщик</div>
      <div
        style="
          display: flex;
          gap: var(--gap-sm);
          align-items: center;
          flex-wrap: wrap;
        "
      >
        <el-select
          v-model="selectedDeveloperId"
          placeholder="Все застройщики"
          clearable
          filterable
          remote
          reserve-keyword
          :remote-method="searchDevelopers"
          :loading="developerLoading"
          style="min-width: 280px"
          @change="load"
          @clear="load"
        >
          <el-option
            v-for="d in developerOptions"
            :key="d.id"
            :label="developerLabel(d)"
            :value="d.id"
          />
        </el-select>
        <el-button type="default" @click="searchDevelopers('')"
          >Показать список</el-button
        >
      </div>
    </el-card>

    <el-empty
      v-if="!isManager"
      description="Доступно только для застройщика или админа"
    />
    <template v-else>
      <el-card shadow="never" style="margin-bottom: var(--gap-md)">
        <div class="muted" style="margin-bottom: 8px">Фильтры</div>
        <div
          style="
            display: flex;
            gap: var(--gap-sm);
            flex-wrap: wrap;
            align-items: center;
          "
        >
          <el-input
            v-model="q"
            clearable
            placeholder="Поиск по объекту/адресу/агенту/ID"
            style="min-width: 320px"
          />
          <el-select
            v-model="selectedStatus"
            clearable
            placeholder="Все статусы"
            style="min-width: 220px"
          >
            <el-option
              v-for="s in [
                ...STATUS_FLOW,
                { key: 'rejected', label: 'Отклонена' },
                { key: 'expired', label: 'Истек срок' },
              ]"
              :key="s.key"
              :label="s.label"
              :value="s.key"
            />
          </el-select>
          <div class="muted">Найдено: {{ tableRows.length }}</div>
        </div>
      </el-card>

      <CRMTable :columns="columns" :rows="pagedRows" :loading="loading" border>
        <template #deadline="{ row }">
          <span v-if="!row.expiresAt">—</span>
          <el-tag v-else :type="deadlineTagType(row)" effect="light">
            {{ formatDate(row.expiresAt) }}
          </el-tag>
        </template>
        <template #status="{ row }">
          <el-tag :type="statusTag(row.status)" effect="light">{{
            statusLabel(row.status)
          }}</el-tag>
        </template>
        <template #actions="{ row }">
          <div style="display: flex; gap: 8px; flex-wrap: wrap">
            <el-button
              v-for="option in statusOptions"
              :key="option.value"
              :type="option.type"
              size="small"
              @click="updateStatus(row.id, option.value)"
            >
              {{ option.label }}
            </el-button>
            <el-button
              v-if="row.status === 'sent'"
              type="default"
              plain
              size="small"
              @click="extendDeadline(row.id)"
              >Продлить срок</el-button
            >

            <el-button
              type="primary"
              plain
              size="small"
              @click="selectForTracking(row.id)"
              >Отследить</el-button
            >
          </div>
        </template>
      </CRMTable>

      <div
        v-if="tableRows.length"
        style="
          display: flex;
          justify-content: center;
          margin-top: var(--gap-md);
        "
      >
        <el-pagination
          v-model:current-page="page"
          v-model:page-size="pageSize"
          :total="tableRows.length"
          :page-sizes="[5, 10, 20, 50, 100]"
          :hide-on-single-page="false"
          layout="total, sizes, prev, pager, next"
        />
      </div>

      <el-card shadow="never" style="margin-top: var(--gap-md)">
        <div class="pill">История</div>
        <div v-if="!selected" class="muted" style="margin-top: 8px">
          Нажмите «Отследить» у нужной заявки.
        </div>
        <template v-else>
          <div style="margin-top: 8px; font-weight: 700">
            Заявка №{{ selected.id }} ·
            {{ selected.property?.title || "Объект" }}
          </div>

          <div class="muted" style="margin-top: 6px">
            Срок до:
            <template v-if="selected.expiresAt">
              <el-tag
                :type="deadlineTagType(selected)"
                effect="light"
                style="margin-left: 6px"
                >{{ formatDate(selected.expiresAt) }}</el-tag
              >
            </template>
            <template v-else>—</template>
          </div>

          <div style="margin-top: 12px">
            <el-steps
              v-if="
                selected.status !== 'rejected' && selected.status !== 'expired'
              "
              :active="statusActiveIndex(selected.status)"
              finish-status="success"
              align-center
            >
              <el-step
                v-for="s in STATUS_FLOW"
                :key="s.key"
                :title="s.label"
                :icon="s.icon"
              />
            </el-steps>

            <div v-else style="display: flex; align-items: center; gap: 8px">
              <el-icon color="var(--el-color-danger)"
                ><CircleCloseFilled
              /></el-icon>
              <el-tag type="danger" effect="light">{{
                selected.status === "expired" ? "Истек срок" : "Отклонена"
              }}</el-tag>
            </div>
          </div>

          <el-divider style="margin: 16px 0" />

          <div class="muted">Дата изменения статуса</div>
          <div
            v-if="!selectedHistory.length"
            class="muted"
            style="margin-top: 8px"
          >
            История отсутствует.
          </div>
          <div v-else style="margin-top: 10px; display: grid; gap: 10px">
            <div
              v-for="h in selectedHistory"
              :key="h.id"
              style="
                display: flex;
                justify-content: space-between;
                gap: 12px;
                flex-wrap: wrap;
              "
            >
              <div style="font-weight: 600">{{ statusLabel(h.status) }}</div>
              <div class="muted">{{ formatDateTime(h.createdAt) }}</div>
            </div>
          </div>
        </template>
      </el-card>
    </template>
  </div>
</template>
