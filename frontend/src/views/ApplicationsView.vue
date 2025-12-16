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

const isAgent = computed(() => auth.user?.role === "agent");
const columns = [
  { prop: "date", label: "Дата", minWidth: 120 },
  { prop: "number", label: "№", width: 80 },
  { prop: "title", label: "Название", minWidth: 180 },
  { prop: "address", label: "Адрес", minWidth: 220 },
  { prop: "price", label: "Стоимость", minWidth: 130 },
  { prop: "commission", label: "Комиссия", minWidth: 130 },
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
  if (status === "rejected") return "Отклонена";
  return status || "—";
}

function statusActiveIndex(status) {
  if (status === "rejected") return 1;
  const idx = STATUS_FLOW.findIndex((s) => s.key === status);
  return idx >= 0 ? idx + 1 : 1;
}

const selectedId = ref(null);
const selected = computed(() =>
  selectedId.value ? items.value.find((a) => a.id === selectedId.value) : null
);

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
  if (status === "awaiting_payment" || status === "contract_signed")
    return "warning";
  return "info";
}
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
      <CRMTable
        :columns="columns"
        :rows="
          items.map((a) => ({
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
              .join(', '),
            price: formatMoney(a.property?.price),
            commission: formatMoney(a.commissionAmount),
            fio: personName(a.agent) || personName(auth.user),
          }))
        "
        :loading="loading"
        stripe
      >
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

          <div style="margin-top: 12px">
            <el-steps
              v-if="selected.status !== 'rejected'"
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
              <el-tag type="danger" effect="light">Отклонена</el-tag>
            </div>
          </div>
        </template>
      </el-card>
    </template>
  </div>
</template>
