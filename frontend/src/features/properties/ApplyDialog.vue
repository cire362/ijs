<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { applicationsApi } from '@/api/endpoints'
import { errorMessage } from '@/api/http'
import type { Property } from '@/api/types'
import { useAuthStore } from '@/stores/auth'
import { formatPhone, formatPrice, isValidRuPhone, personName } from '@/utils/format'

const props = defineProps<{ property: Property }>()
const open = defineModel<boolean>({ required: true })
const auth = useAuthStore()
const router = useRouter()
const form = reactive({ clientFullName: '', clientPhone: '', comment: '' })
const saving = ref(false)
const error = ref('')
const individual = computed(() => auth.role === 'individual')
const profileIncomplete = computed(() => individual.value && (!auth.user?.phone || !personName(auth.user)))

watch(open, (value) => {
  if (!value) return
  Object.assign(form, { clientFullName: '', clientPhone: '', comment: '' })
  error.value = ''
})

async function submit () {
  error.value = ''
  if (!individual.value) {
    if (!form.clientFullName.trim()) { error.value = 'Укажите ФИО клиента'; return }
    if (!isValidRuPhone(form.clientPhone)) { error.value = 'Укажите телефон клиента, например +7 900 100-00-11'; return }
  }
  saving.value = true
  try {
    const created = await applicationsApi.create({
      propertyId: props.property.id,
      clientFullName: individual.value ? undefined : form.clientFullName.trim(),
      clientPhone: individual.value ? undefined : formatPhone(form.clientPhone),
      comment: form.comment.trim() || undefined
    })
    open.value = false
    ElMessage.success(`Заявка №${created.id} отправлена застройщику`)
    await router.push({ path: '/applications', query: { app: String(created.id) } })
  } catch (e) {
    error.value = errorMessage(e, 'Не удалось отправить заявку')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <el-dialog v-model="open" title="Заявка на объект" width="min(520px, 94vw)" align-center>
    <div class="mb-5 rounded-control bg-surface-2 p-4">
      <p class="font-medium text-ink">{{ property.title }}</p>
      <p class="mt-0.5 text-sm text-muted">{{ formatPrice(property.price) }}</p>
    </div>
    <el-form label-position="top" @submit.prevent="submit">
      <template v-if="individual">
        <p class="mb-4 text-sm text-muted">Заявка подаётся на вас: <span class="text-ink">{{ personName(auth.user) || 'ФИО не заполнено' }}</span>, {{ auth.user?.phone || 'телефон не указан' }}.</p>
        <p v-if="profileIncomplete" class="mb-4 rounded-control bg-warning-soft px-3 py-2 text-sm text-ink">Заполните ФИО и телефон в <router-link to="/profile" class="link">профиле</router-link>, иначе заявку не примут.</p>
      </template>
      <template v-else>
        <el-form-item label="ФИО клиента"><el-input v-model="form.clientFullName" maxlength="200" autocomplete="off" /></el-form-item>
        <el-form-item label="Телефон клиента"><el-input v-model="form.clientPhone" type="tel" maxlength="50" placeholder="+7 900 100-00-11" @blur="form.clientPhone = formatPhone(form.clientPhone)" /></el-form-item>
        <p class="-mt-2 mb-4 text-xs text-subtle">Активная заявка закрепляет клиента за вами на этом объекте.</p>
      </template>
      <el-form-item label="Комментарий для застройщика"><el-input v-model="form.comment" type="textarea" :autosize="{ minRows: 2, maxRows: 6 }" maxlength="2000" /></el-form-item>
      <p class="text-xs text-subtle">Заявка действует 7 дней. Застройщик может продлить срок или подтвердить бронь.</p>
      <p v-if="error" class="mt-3 rounded-control bg-danger-soft px-3 py-2 text-sm text-danger" role="alert">{{ error }}</p>
    </el-form>
    <template #footer>
      <el-button @click="open = false">Отмена</el-button>
      <el-button type="primary" :loading="saving" :disabled="profileIncomplete" @click="submit">Отправить заявку</el-button>
    </template>
  </el-dialog>
</template>
