<script setup>
import { computed, onMounted, ref } from "vue";
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

const q = ref("");
const selectedStatus = ref("");

const isAgent = computed(() => auth.user?.role === "agent");
const columns = [
  { prop: "date", label: "Дата", minWidth: 120 },
  { prop: "number", label: "№", width: 80 },
  { prop: "title", label: "Название", minWidth: 180 },
  { prop: "address", label: "Адрес", minWidth: 220 },
  { prop: "price", label: "Стоимость", minWidth: 130 },
  { prop: "commission", label: "Комиссия", minWidth: 130 },
  { prop: "deadline", label: "Срок до", minWidth: 130 },
  { prop: "fio", label: "ФИО", minWidth: 180 },
  { prop: "status", label: "Статус", minWidth: 160 },
];

const STATUS_FLOW = [
  { key: "sent", label: "Заявка отправлена", icon: UploadFilled },
  { key: "confirmed", label: "Заявка подтверждена", icon: CircleCheckFilled },
  { key: "contract_signed", label: "Договор заключен", icon: DocumentChecked },
  { key: "awaiting_payment", label: "Ожидание оплаты", icon: Clock },
  { key: "commission_available", label: "Комиссия доступна", icon: Coin },
  { key: "done", label: "Завершено", icon: Finished },
];

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
  return d.toLocaleString("ru-RU", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function personName(u) {
  if (!u) return "";
  return (
    u.fullName ||
    [u.lastName, u.firstName, u.middleName].filter(Boolean).join(" ") ||
    u.name ||
    ""
  );
}

function statusLabel(status) {
  const found = STATUS_FLOW.find((s) => s.key === status);
  if (found) return found.label;
  if (status === "rejected" || status === "expired") return "Отменена";
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
  return [...h].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
});

function selectForTracking(id) {
  selectedId.value = id;
}

onMounted(() => {
  if (auth.token) {
    apiClient.defaults.headers.common.Authorization = `Bearer ${auth.token}`;
    load();
  }
});

async function load() {
  loading.value = true;
  try {
    const { data } = await apiClient.get("/applications/mine");
    items.value = data;
  } catch (err) {
    ElMessage.error(err.response?.data?.error || "Не удалось загрузить");
  } finally {
    loading.value = false;
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

function deadlineTagType(row) {
  if (!row?.expiresAt) return "info";
  const t = new Date(row.expiresAt).getTime();
  if (Number.isNaN(t)) return "info";
  if (row.status === "expired") return "danger";
  const now = Date.now();
  if (now > t) return "danger";
  const daysLeft = (t - now) / (24 * 60 * 60 * 1000);
  if (row.status === "sent" && daysLeft <= 2) return "warning";
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
    const hay = [a.id, p?.title, p?.region, p?.city, p?.street, p?.plotNumber]
      .filter(Boolean)
      .map((x) => normalizeText(x))
      .join(" ");

    return hay.includes(qq);
  });
});

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
    deadline: a.expiresAt ? formatDate(a.expiresAt) : "—",
    fio: personName(a.agent) || personName(auth.user),
  }))
);
</script>

<template>
  <div>
    <div class="section-head">
      <div>
        <div class="pill">Ваши сделки</div>
        <h2 style="margin: 4px 0">Мои заявки</h2>
        <div class="muted">
          Прогресс отправленных заявок и история статусов.
        </div>
      </div>
      <el-button @click="load" :loading="loading" type="default"
        >Обновить</el-button
      >
    </div>

    <el-empty
      v-if="!auth.user"
      description="Авторизуйтесь, чтобы видеть заявки"
    />
    <el-empty
      v-else-if="!isAgent"
      description="Раздел доступен только агенту"
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
            placeholder="Поиск по названию/адресу/ID"
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
                { key: 'rejected', label: 'Отменена' },
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

      <CRMTable :columns="columns" :rows="tableRows" :loading="loading" stripe>
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
          <el-button
            type="primary"
            plain
            size="small"
            @click="selectForTracking(row.id)"
            >Отследить</el-button
          >
        </template>
      </CRMTable>

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
              <el-tag type="danger" effect="light">{{ "Отменена" }}</el-tag>
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
