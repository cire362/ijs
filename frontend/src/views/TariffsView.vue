<script setup>
import { ref, computed, onMounted, watch } from "vue";
import { useAuthStore, apiClient } from "../stores/auth";
import { ElMessage } from "element-plus";

const auth = useAuthStore();

const categoryTab = ref("apartments");

const loading = ref(false);
const counterparties = ref([]);
const activeCounterpartyId = ref(null);
const activeComplexId = ref(null);

const isAdmin = computed(() => auth.user?.role === "admin");

const includeInactive = ref(false);

const viewEndpoint = computed(() =>
  isAdmin.value ? "/tariffs/admin/view" : "/tariffs/view",
);

const activeCounterparty = computed(
  () =>
    counterparties.value.find((c) => c.id === activeCounterpartyId.value) ||
    null,
);

const complexes = computed(() => {
  const list = activeCounterparty.value?.complexes;
  return Array.isArray(list) ? list : [];
});

const activeComplex = computed(
  () => complexes.value.find((c) => c.id === activeComplexId.value) || null,
);

function pickDefaults() {
  if (!counterparties.value.length) {
    activeCounterpartyId.value = null;
    activeComplexId.value = null;
    return;
  }

  if (
    !activeCounterpartyId.value ||
    !counterparties.value.some((c) => c.id === activeCounterpartyId.value)
  ) {
    activeCounterpartyId.value = counterparties.value[0].id;
  }

  const cx = complexes.value;
  if (!cx.length) {
    activeComplexId.value = null;
    return;
  }

  if (
    !activeComplexId.value ||
    !cx.some((c) => c.id === activeComplexId.value)
  ) {
    activeComplexId.value = cx[0].id;
  }
}

async function fetchView() {
  loading.value = true;
  try {
    const { data } = await apiClient.get(viewEndpoint.value, {
      params: {
        category: categoryTab.value,
        ...(isAdmin.value ? { includeInactive: includeInactive.value } : {}),
      },
    });

    counterparties.value = Array.isArray(data?.counterparties)
      ? data.counterparties
      : [];
    pickDefaults();
  } catch (e) {
    console.error(e);
    ElMessage.error("Не удалось загрузить тарифную карту");
  } finally {
    loading.value = false;
  }
}

function fmtCommission(rate) {
  if (!rate) return "—";
  const from = rate.commissionFrom;
  const to = rate.commissionTo;
  const fromNum = from == null ? null : Number(from);
  const toNum = to == null ? null : Number(to);

  const fmt = (n) => {
    if (n == null || !Number.isFinite(n)) return "";
    const s = n.toFixed(2);
    return s.replace(/\.00$/, "");
  };

  if (toNum == null || !Number.isFinite(toNum) || toNum === fromNum) {
    return `${fmt(fromNum)} %`;
  }
  return `${fmt(fromNum)} – ${fmt(toNum)} %`;
}

const tableRows = computed(() => {
  return complexes.value.map((cx) => ({
    id: cx.id,
    name: cx.name,
    isActive: cx.isActive,
    rate: cx.rate,
  }));
});

const rateDialogOpen = ref(false);
const rateForm = ref({
  commissionFrom: 0,
  commissionTo: null,
  notes: "",
  isActive: true,
});

const notesDialogOpen = ref(false);
const notesDialogText = ref("");

function openEditRate(row) {
  activeComplexId.value = row.id;
  const r = row.rate;
  rateForm.value = {
    commissionFrom: r?.commissionFrom != null ? Number(r.commissionFrom) : 0,
    commissionTo: r?.commissionTo != null ? Number(r.commissionTo) : null,
    notes: r?.notes || "",
    isActive: r?.isActive == null ? true : Boolean(r.isActive),
  };
  rateDialogOpen.value = true;
}

async function saveRate() {
  try {
    await apiClient.put(
      `/tariffs/properties/${activeComplex.value.id}/rates/${categoryTab.value}`,
      {
        commissionFrom: rateForm.value.commissionFrom,
        commissionTo: rateForm.value.commissionTo,
        notes: rateForm.value.notes,
        isActive: rateForm.value.isActive,
      },
    );
    rateDialogOpen.value = false;
    await fetchView();
  } catch (e) {
    console.error(e);
    ElMessage.error("Не удалось сохранить ставку");
  }
}

function showNotes(text) {
  notesDialogText.value = text || "";
  notesDialogOpen.value = true;
}

watch([categoryTab, includeInactive], () => {
  fetchView();
});

onMounted(() => {
  fetchView();
});
</script>

<template>
  <div class="mt-6">
    <div
      class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
    >
      <div class="px-6 pt-5 pb-3 border-b border-gray-100">
        <div class="flex items-center justify-between gap-4">
          <div class="font-bold text-gray-900">Тарифная карта</div>
          <div v-if="isAdmin" class="flex items-center gap-2">
            <div class="hidden md:flex items-center gap-2 mr-2">
              <!-- <span class="text-xs text-gray-600">Показывать неактивные</span>
              <el-switch v-model="includeInactive" /> -->
            </div>
          </div>
        </div>

        <div class="mt-4">
          <el-tabs v-model="categoryTab" class="tariff-tabs">
            <el-tab-pane label="Объекты" name="apartments" />
          </el-tabs>
        </div>
      </div>

      <div class="p-6">
        <div class="grid grid-cols-1 md:grid-cols-[320px_1fr] gap-6">
          <div
            class="bg-gray-50 rounded-xl border border-gray-100 overflow-hidden"
          >
            <div
              class="px-4 py-3 border-b border-gray-100 flex items-center justify-between"
            >
              <div class="text-sm font-semibold text-gray-700">Застройщики</div>
            </div>

            <div class="max-h-[640px] overflow-y-auto">
              <div v-if="loading" class="p-6 text-sm text-gray-500">
                Загрузка…
              </div>
              <div
                v-else-if="counterparties.length === 0"
                class="p-6 text-sm text-gray-500"
              >
                Пока нет данных
              </div>
              <div
                v-for="cp in counterparties"
                :key="cp.id"
                class="px-4 py-3 cursor-pointer border-b border-gray-100 hover:bg-white transition"
                :class="{
                  'bg-white': activeCounterpartyId === cp.id,
                  'opacity-60': isAdmin && cp.isActive === false,
                }"
                @click="activeCounterpartyId = cp.id"
              >
                <div class="font-semibold text-sm text-gray-900 truncate">
                  {{ cp.name }}
                </div>
                <div class="text-xs text-gray-500 mt-1">
                  <span v-if="isAdmin && cp.isActive === false">Неактивно</span>
                  <span v-else>&nbsp;</span>
                </div>
              </div>
            </div>
          </div>

          <div
            class="bg-white rounded-xl border border-gray-100 overflow-hidden"
          >
            <div
              class="px-4 py-3 border-b border-gray-100 flex items-center justify-between"
            >
              <div class="text-sm font-semibold text-gray-700">
                {{
                  activeCounterparty
                    ? activeCounterparty.name
                    : "Выберите застройщика"
                }}
              </div>
            </div>

            <el-table
              v-loading="loading"
              :data="tableRows"
              style="width: 100%"
              empty-text="Нет данных"
            >
              <el-table-column
                prop="name"
                label="Объект недвижимости"
                min-width="220"
              >
                <template #default="{ row }">
                  <div class="flex items-center gap-2">
                    <span class="font-medium text-gray-900">{{
                      row.name
                    }}</span>
                    <el-tag
                      v-if="isAdmin && row.isActive === false"
                      size="small"
                      type="info"
                      >неактивно</el-tag
                    >
                  </div>
                </template>
              </el-table-column>

              <el-table-column label="Вознаграждение" width="160">
                <template #default="{ row }">
                  <span class="font-semibold">{{
                    fmtCommission(row.rate)
                  }}</span>
                </template>
              </el-table-column>

              <el-table-column label="Примечания" min-width="280">
                <template #default="{ row }">
                  <div class="text-sm text-gray-700">
                    <span v-if="!row.rate?.notes">—</span>
                    <template v-else>
                      <span
                        class="truncate inline-block align-bottom max-w-[360px]"
                        >{{ row.rate.notes }}</span
                      >
                      <el-link
                        class="ml-2"
                        type="primary"
                        :underline="false"
                        @click="showNotes(row.rate.notes)"
                      >
                        Показать полностью
                      </el-link>
                    </template>
                  </div>
                </template>
              </el-table-column>

              <el-table-column
                v-if="isAdmin"
                label=""
                width="200"
                align="right"
              >
                <template #default="{ row }">
                  <div class="flex justify-end gap-2">
                    <el-button
                      size="small"
                      type="primary"
                      @click="openEditRate(row)"
                      >Ставка</el-button
                    >
                  </div>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </div>
      </div>
    </div>

    <!-- Rate dialog -->
    <el-dialog v-model="rateDialogOpen" title="Ставка" width="560px">
      <el-form label-position="top">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <el-form-item label="Комиссия от, %">
            <el-input-number
              v-model="rateForm.commissionFrom"
              :min="0"
              :step="0.1"
              :precision="2"
              class="w-full"
            />
          </el-form-item>
          <el-form-item label="Комиссия до, %">
            <el-input-number
              v-model="rateForm.commissionTo"
              :min="0"
              :step="0.1"
              :precision="2"
              class="w-full"
            />
          </el-form-item>
        </div>
        <el-form-item label="Примечания">
          <el-input
            v-model="rateForm.notes"
            type="textarea"
            :rows="5"
            placeholder="Текст примечаний"
          />
        </el-form-item>
        <el-form-item label="Активность">
          <el-switch v-model="rateForm.isActive" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="rateDialogOpen = false">Отмена</el-button>
        <el-button type="primary" @click="saveRate">Сохранить</el-button>
      </template>
    </el-dialog>

    <!-- Notes dialog -->
    <el-dialog v-model="notesDialogOpen" title="Примечания" width="720px">
      <div class="whitespace-pre-wrap text-sm text-gray-800">
        {{ notesDialogText }}
      </div>
      <template #footer>
        <el-button type="primary" @click="notesDialogOpen = false"
          >Закрыть</el-button
        >
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.tariff-tabs :deep(.el-tabs__header) {
  margin: 0;
}
</style>
