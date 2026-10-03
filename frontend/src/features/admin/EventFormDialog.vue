<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { eventsApi, type EventPayload } from '@/api/endpoints'
import { errorMessage } from '@/api/http'
import type { PlatformEvent } from '@/api/types'
import { EVENT_FORMAT } from '@/utils/status'

const props = defineProps<{ event?: PlatformEvent | null }>()
const open = defineModel<boolean>({ required: true })
const emit = defineEmits<{ saved: [event: PlatformEvent] }>()

const saving = ref(false)
const error = ref('')
const cover = ref<File | null>(null)
const editing = computed(() => Boolean(props.event))
const started = computed(() => Boolean(props.event && new Date(props.event.startAt) <= new Date()))
const form = reactive({ title: '', description: '', location: '', format: 'offline' as string, startAt: null as Date | null, endAt: null as Date | null, capacity: null as number | null, isTraining: false })

watch(open, (value) => {
  if (!value) return
  error.value = ''
  cover.value = null
  const e = props.event
  Object.assign(form, e
    ? { title: e.title, description: e.description ?? '', location: e.location ?? '', format: e.format ?? 'offline', startAt: new Date(e.startAt), endAt: e.endAt ? new Date(e.endAt) : null, capacity: e.capacity, isTraining: e.isTraining }
    : { title: '', description: '', location: '', format: 'offline', startAt: null, endAt: null, capacity: null, isTraining: false })
})

function disabledPast (date: Date) {
  return date.getTime() < Date.now() - 86400000
}

async function save () {
  error.value = ''
  if (!form.title.trim()) { error.value = 'Укажите название'; return }
  if (!form.startAt) { error.value = 'Укажите дату начала'; return }
  if (!started.value && form.startAt <= new Date()) { error.value = 'Дата начала должна быть в будущем'; return }
  if (form.endAt && form.endAt <= form.startAt) { error.value = 'Окончание должно быть позже начала'; return }
  saving.value = true
  const payload: EventPayload = {
    title: form.title.trim(),
    description: form.description.trim() || null,
    location: form.location.trim() || null,
    format: form.format,
    startAt: form.startAt.toISOString(),
    endAt: form.endAt ? form.endAt.toISOString() : null,
    capacity: form.capacity || null,
    isTraining: form.isTraining
  }
  try {
    let saved: PlatformEvent
    if (props.event) {
      const patch: Partial<EventPayload> = { ...payload }
      // A started event keeps its start time; the server rejects moving it.
      if (started.value || new Date(props.event.startAt).getTime() === form.startAt.getTime()) delete patch.startAt
      saved = await eventsApi.update(props.event.id, patch)
    } else {
      saved = await eventsApi.create(payload)
    }
    if (cover.value) saved = await eventsApi.uploadCover(saved.id, cover.value)
    ElMessage.success(props.event ? 'Мероприятие обновлено, участники получат уведомление об изменениях' : 'Мероприятие создано')
    emit('saved', saved)
    open.value = false
  } catch (e) {
    error.value = errorMessage(e, 'Не удалось сохранить мероприятие')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <el-dialog v-model="open" :title="editing ? 'Редактирование мероприятия' : 'Новое мероприятие'" width="min(640px, 94vw)" align-center>
    <el-form label-position="top" @submit.prevent="save">
      <el-form-item label="Название" required><el-input v-model="form.title" maxlength="200" show-word-limit /></el-form-item>
      <div class="grid gap-x-4 sm:grid-cols-2">
        <el-form-item label="Начало" required>
          <el-date-picker v-model="form.startAt" type="datetime" format="DD.MM.YYYY HH:mm" :disabled="started" :disabled-date="disabledPast" class="!w-full" />
        </el-form-item>
        <el-form-item label="Окончание"><el-date-picker v-model="form.endAt" type="datetime" format="DD.MM.YYYY HH:mm" :disabled-date="disabledPast" class="!w-full" /></el-form-item>
        <el-form-item label="Формат">
          <el-select v-model="form.format" class="w-full"><el-option v-for="(label, value) in EVENT_FORMAT" :key="value" :value="value" :label="label" /></el-select>
        </el-form-item>
        <el-form-item label="Количество мест"><el-input-number v-model="form.capacity" :min="1" :max="1000000" :controls="false" placeholder="Без ограничения" class="!w-full" /></el-form-item>
      </div>
      <el-form-item label="Место или ссылка"><el-input v-model="form.location" maxlength="300" /></el-form-item>
      <el-form-item label="Описание"><el-input v-model="form.description" type="textarea" :autosize="{ minRows: 3, maxRows: 10 }" maxlength="5000" show-word-limit /></el-form-item>
      <el-form-item><el-checkbox v-model="form.isTraining">Обучающее мероприятие</el-checkbox></el-form-item>
      <el-form-item label="Обложка">
        <input type="file" accept="image/jpeg,image/png,image/webp" class="text-sm text-muted" @change="cover = ($event.target as HTMLInputElement).files?.[0] ?? null">
      </el-form-item>
      <p v-if="started" class="mb-2 text-xs text-subtle">Мероприятие уже началось: перенести его нельзя, остальные поля можно уточнить.</p>
      <p v-if="error" class="rounded-control bg-danger-soft px-3 py-2 text-sm text-danger" role="alert">{{ error }}</p>
    </el-form>
    <template #footer>
      <el-button @click="open = false">Отмена</el-button>
      <el-button type="primary" :loading="saving" @click="save">{{ editing ? 'Сохранить' : 'Создать' }}</el-button>
    </template>
  </el-dialog>
</template>
