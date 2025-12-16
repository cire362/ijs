<template>
  <div class="filters">
    <el-input
      v-model="search"
      placeholder="Название, город, регион"
      clearable
      style="max-width: 260px"
    />

    <el-select
      v-model="region"
      placeholder="Регион"
      clearable
      style="width: 200px"
    >
      <el-option v-for="r in regions" :key="r" :label="r" :value="r" />
    </el-select>

    <el-select
      v-model="city"
      placeholder="Город"
      clearable
      style="width: 180px"
    >
      <el-option v-for="c in cities" :key="c" :label="c" :value="c" />
    </el-select>

    <el-select
      v-model="status"
      placeholder="Статус"
      clearable
      style="width: 160px"
    >
      <el-option label="Доступен" value="available" />
      <el-option label="Бронь" value="reserved" />
      <el-option label="Продан" value="sold" />
    </el-select>

    <el-select
      v-model="buildStage"
      placeholder="Стадия"
      clearable
      style="width: 160px"
    >
      <el-option v-for="s in stages" :key="s" :label="s" :value="s" />
    </el-select>

    <el-select
      v-model="finishingType"
      placeholder="Отделка"
      clearable
      style="width: 170px"
    >
      <el-option v-for="s in finishingTypes" :key="s" :label="s" :value="s" />
    </el-select>

    <el-select
      v-model="contractType"
      placeholder="Договор"
      clearable
      style="width: 170px"
    >
      <el-option v-for="s in contractTypes" :key="s" :label="s" :value="s" />
    </el-select>

    <el-select
      v-model="constructionType"
      placeholder="Конструкция"
      clearable
      style="width: 190px"
    >
      <el-option
        v-for="s in constructionTypes"
        :key="s"
        :label="s"
        :value="s"
      />
    </el-select>

    <el-select
      v-model="readinessType"
      placeholder="Готовность"
      clearable
      style="width: 190px"
    >
      <el-option v-for="s in readinessTypes" :key="s" :label="s" :value="s" />
    </el-select>

    <el-input
      v-model.number="priceMin"
      placeholder="Цена от"
      type="number"
      style="width: 140px"
    />
    <el-input
      v-model.number="priceMax"
      placeholder="Цена до"
      type="number"
      style="width: 140px"
    />

    <el-input
      v-model.number="landMin"
      placeholder="Участок от (сот.)"
      type="number"
      style="width: 160px"
    />
    <el-input
      v-model.number="landMax"
      placeholder="Участок до (сот.)"
      type="number"
      style="width: 160px"
    />

    <el-input
      v-model.number="houseMin"
      placeholder="Дом от (м²)"
      type="number"
      style="width: 150px"
    />
    <el-input
      v-model.number="houseMax"
      placeholder="Дом до (м²)"
      type="number"
      style="width: 150px"
    />

    <el-button type="warning" @click="apply">Найти</el-button>
    <el-button text type="info" @click="reset">Сбросить</el-button>
  </div>
</template>

<script setup>
import { ref } from "vue";

defineProps({
  regions: { type: Array, default: () => [] },
  cities: { type: Array, default: () => [] },
  stages: { type: Array, default: () => [] },
  finishingTypes: { type: Array, default: () => [] },
  contractTypes: { type: Array, default: () => [] },
  constructionTypes: { type: Array, default: () => [] },
  readinessTypes: { type: Array, default: () => [] },
});

const emit = defineEmits(["apply", "reset"]);
const search = ref("");
const region = ref("");
const city = ref("");
const status = ref("");
const buildStage = ref("");
const finishingType = ref("");
const contractType = ref("");
const constructionType = ref("");
const readinessType = ref("");

const priceMin = ref(null);
const priceMax = ref(null);
const landMin = ref(null);
const landMax = ref(null);
const houseMin = ref(null);
const houseMax = ref(null);

function apply() {
  emit("apply", {
    search: search.value,
    region: region.value,
    city: city.value,
    status: status.value,
    buildStage: buildStage.value,
    finishingType: finishingType.value,
    contractType: contractType.value,
    constructionType: constructionType.value,
    readinessType: readinessType.value,
    priceMin: priceMin.value,
    priceMax: priceMax.value,
    landMin: landMin.value,
    landMax: landMax.value,
    houseMin: houseMin.value,
    houseMax: houseMax.value,
  });
}
function reset() {
  search.value = "";
  region.value = "";
  city.value = "";
  status.value = "";
  buildStage.value = "";
  finishingType.value = "";
  contractType.value = "";
  constructionType.value = "";
  readinessType.value = "";

  priceMin.value = null;
  priceMax.value = null;
  landMin.value = null;
  landMax.value = null;
  houseMin.value = null;
  houseMax.value = null;
  emit("reset");
}
</script>

<style scoped>
.filters {
  display: flex;
  flex-wrap: wrap;
  gap: var(--gap-sm);
  align-items: center;
  padding: var(--gap-sm);
  background: var(--muted-bg);
  border-radius: var(--radius);
  border: 1px solid #e7e7e7;
}
</style>
