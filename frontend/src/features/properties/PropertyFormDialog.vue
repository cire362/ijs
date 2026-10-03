<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import type { FormInstance, FormRules } from 'element-plus'
import { ElMessage } from 'element-plus'
import { propertiesApi, usersApi, type PropertyPayload } from '@/api/endpoints'
import { errorMessage } from '@/api/http'
import type { Property, User } from '@/api/types'
import { useAuthStore } from '@/stores/auth'
import { personName } from '@/utils/format'
import { BUILD_STAGES, CONSTRUCTION_TYPES, CONTRACT_TYPES, FINISHING_TYPES, READINESS_TYPES, REGISTRATIONS } from '@/utils/propertyOptions'
import { SALE_STATUS } from '@/utils/status'
import AddressInput from '@/components/property/AddressInput.vue'

const props = defineProps<{ property?: Property | null }>()
const open = defineModel<boolean>({ required: true })
const emit = defineEmits<{ saved: [property: Property] }>()

const auth = useAuthStore()
const formRef = ref<FormInstance>()
const saving = ref(false)
const error = ref('')
const developers = ref<User[]>([])
const editing = computed(() => Boolean(props.property))

const empty = () => ({
  title: '', region: '', city: '', street: '', plotNumber: '',
  landArea: null as number | null, houseArea: null as number | null, floors: null as number | null, rooms: null as number | null,
  price: null as number | null, buildStage: '', constructionType: '', finishingType: '', contractType: '', readinessType: '', registration: '',
  saleStatus: 'available' as Property['saleStatus'], description: '', developerId: null as number | null
})
const form = reactive(empty())

watch(open, async (value) => {
  if (!value) return
  error.value = ''
  Object.assign(form, empty())
  const p = props.property
  if (p) {
    Object.assign(form, {
      title: p.title, region: p.region, city: p.city, street: p.street ?? '', plotNumber: p.plotNumber ?? '',
      landArea: p.landArea, houseArea: p.houseArea, floors: p.floors, rooms: p.rooms, price: p.price == null ? null : Number(p.price),
      buildStage: p.buildStage ?? '', constructionType: p.constructionType ?? '', finishingType: p.finishingType ?? '',
      contractType: p.contractType ?? '', readinessType: p.readinessType ?? '', registration: p.registration ?? '',
      saleStatus: p.saleStatus, description: p.description ?? '', developerId: p.developerId
    })
  }
  if (auth.isAdmin && !developers.value.length) {
    developers.value = await usersApi.developers({ status: 'approved' }).catch(() => [])
  }
})

const rules: FormRules = {
  title: [{ required: true, message: 'Укажите название', trigger: 'blur' }],
  region: [{ required: true, message: 'Укажите регион', trigger: 'blur' }],
  city: [{ required: true, message: 'Укажите город', trigger: 'blur' }],
  developerId: [{ validator: (_r, value, cb) => (auth.isAdmin && !editing.value && !value ? cb(new Error('Выберите застройщика')) : cb()), trigger: 'change' }]
}

async function save () {
  if (!(await formRef.value?.validate().catch(() => false))) return
  saving.value = true
  error.value = ''
  const payload: PropertyPayload = {
    ...form,
    street: form.street || null,
    plotNumber: form.plotNumber || null,
    buildStage: form.buildStage || null,
    constructionType: form.constructionType || null,
    finishingType: form.finishingType || null,
    contractType: form.contractType || null,
    readinessType: form.readinessType || null,
    registration: form.registration || null,
    description: form.description || null,
    developerId: auth.isAdmin && form.developerId != null ? form.developerId : undefined
  }
  if (!auth.isAdmin) delete payload.developerId
  try {
    const saved = props.property
      ? await propertiesApi.update(props.property.id, payload)
      : await propertiesApi.create(payload)
    ElMessage.success(props.property ? 'Изменения сохранены' : 'Объект добавлен')
    emit('saved', saved)
    open.value = false
  } catch (e) {
    error.value = errorMessage(e, 'Не удалось сохранить объект')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <el-dialog v-model="open" :title="editing ? 'Редактирование объекта' : 'Новый объект'" width="min(760px, 94vw)" align-center destroy-on-close>
    <el-form ref="formRef" :model="form" :rules="rules" label-position="top" @submit.prevent="save">
      <el-form-item v-if="auth.isAdmin" label="Застройщик" prop="developerId">
        <el-select v-model="form.developerId" filterable placeholder="Выберите подтверждённого застройщика" class="w-full">
          <el-option v-for="dev in developers" :key="dev.id" :value="dev.id" :label="dev.companyName || personName(dev)" />
        </el-select>
      </el-form-item>
      <el-form-item label="Название" prop="title"><el-input v-model="form.title" maxlength="255" show-word-limit /></el-form-item>
      <div class="grid gap-x-4 md:grid-cols-3">
        <el-form-item label="Регион" prop="region"><AddressInput v-model="form.region" kind="region" /></el-form-item>
        <el-form-item label="Город" prop="city"><AddressInput v-model="form.city" kind="city" :region="form.region" /></el-form-item>
        <el-form-item label="Улица"><AddressInput v-model="form.street" kind="street" :region="form.region" :city="form.city" /></el-form-item>
      </div>
      <div class="grid gap-x-4 grid-cols-2 md:grid-cols-4">
        <el-form-item label="Цена, ₽"><el-input-number v-model="form.price" :min="0" :max="999999999999" :step="100000" :controls="false" class="!w-full" /></el-form-item>
        <el-form-item label="Площадь дома, м²"><el-input-number v-model="form.houseArea" :min="0" :controls="false" class="!w-full" /></el-form-item>
        <el-form-item label="Участок, соток"><el-input-number v-model="form.landArea" :min="0" :controls="false" class="!w-full" /></el-form-item>
        <el-form-item label="№ участка"><el-input v-model="form.plotNumber" maxlength="200" /></el-form-item>
        <el-form-item label="Этажность"><el-input-number v-model="form.floors" :min="1" :max="1000" :controls="false" class="!w-full" /></el-form-item>
        <el-form-item label="Комнат"><el-input-number v-model="form.rooms" :min="0" :max="1000" :controls="false" class="!w-full" /></el-form-item>
        <el-form-item label="Статус продажи">
          <el-select v-model="form.saleStatus" class="w-full">
            <el-option v-for="(meta, value) in SALE_STATUS" :key="value" :value="value" :label="meta.label" />
          </el-select>
        </el-form-item>
        <el-form-item label="Стадия строительства"><el-select v-model="form.buildStage" clearable class="w-full"><el-option v-for="o in BUILD_STAGES" :key="o" :value="o" :label="o" /></el-select></el-form-item>
        <el-form-item label="Конструкция"><el-select v-model="form.constructionType" clearable class="w-full"><el-option v-for="o in CONSTRUCTION_TYPES" :key="o" :value="o" :label="o" /></el-select></el-form-item>
        <el-form-item label="Отделка"><el-select v-model="form.finishingType" clearable class="w-full"><el-option v-for="o in FINISHING_TYPES" :key="o" :value="o" :label="o" /></el-select></el-form-item>
        <el-form-item label="Тип договора"><el-select v-model="form.contractType" clearable class="w-full"><el-option v-for="o in CONTRACT_TYPES" :key="o" :value="o" :label="o" /></el-select></el-form-item>
        <el-form-item label="Готовность"><el-select v-model="form.readinessType" clearable class="w-full"><el-option v-for="o in READINESS_TYPES" :key="o" :value="o" :label="o" /></el-select></el-form-item>
        <el-form-item label="Категория земли"><el-select v-model="form.registration" clearable class="w-full"><el-option v-for="o in REGISTRATIONS" :key="o" :value="o" :label="o" /></el-select></el-form-item>
      </div>
      <el-form-item label="Описание"><el-input v-model="form.description" type="textarea" :autosize="{ minRows: 4, maxRows: 12 }" maxlength="20000" show-word-limit /></el-form-item>
      <p v-if="editing" class="-mt-2 mb-2 text-xs text-subtle">Статус объекта со сделкой в работе меняется через заявку. Изменение цены попадает в журнал изменений.</p>
      <p v-if="error" class="rounded-control bg-danger-soft px-3 py-2 text-sm text-danger" role="alert">{{ error }}</p>
    </el-form>
    <template #footer>
      <el-button @click="open = false">Отмена</el-button>
      <el-button type="primary" :loading="saving" @click="save">{{ editing ? 'Сохранить' : 'Добавить объект' }}</el-button>
    </template>
  </el-dialog>
</template>
