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

const isManager = computed(
  () => auth.user?.role === "developer" || auth.user?.role === "admin"
);
const isAdmin = computed(() => auth.user?.role === "admin");

const selectedDeveloperId = ref("");
const developerOptions = ref([]);
const developerLoading = ref(false);
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
            developer: developerLabel(a.property?.developer),
            agentFio: personName(a.agent),
          }))
        "
        :loading="loading"
        border
      >
        <template #status="{ row }">
          <el-tag :type="statusTag(row.status)" effect="light">{{
            statusLabel(row.status)
          }}</el-tag>
        </template>
        <template #actions="{ row }">
          <el-button-group>
            <el-button
              v-for="option in statusOptions"
              :key="option.value"
              :type="option.type"
              size="small"
              @click="updateStatus(row.id, option.value)"
            >
              {{ option.label }}
            </el-button>
          </el-button-group>

          <el-button
            style="margin-left: 8px"
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
