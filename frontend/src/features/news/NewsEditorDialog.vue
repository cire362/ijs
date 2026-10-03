<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { newsApi } from '@/api/endpoints'
import { errorMessage } from '@/api/http'
import type { NewsItem } from '@/api/types'

const props = defineProps<{ item?: NewsItem | null }>()
const open = defineModel<boolean>({ required: true })
const emit = defineEmits<{ saved: [item: NewsItem] }>()

const form = reactive({ title: '', subtitle: '', excerpt: '', content: '', isPublished: true })
const images = ref<File[]>([])
const saving = ref(false)
const error = ref('')
const editing = computed(() => Boolean(props.item))

watch(open, (value) => {
  if (!value) return
  error.value = ''
  images.value = []
  const item = props.item
  Object.assign(form, item
    ? { title: item.title, subtitle: item.subtitle ?? '', excerpt: item.excerpt ?? '', content: item.content, isPublished: item.isPublished }
    : { title: '', subtitle: '', excerpt: '', content: '', isPublished: true })
})

function pick (event: Event) {
  images.value = Array.from((event.target as HTMLInputElement).files ?? []).slice(0, 10)
}

async function save () {
  error.value = ''
  if (!form.title.trim()) { error.value = 'Укажите заголовок'; return }
  if (!form.content.trim()) { error.value = 'Добавьте текст новости'; return }
  saving.value = true
  const payload = { title: form.title.trim(), subtitle: form.subtitle.trim() || null, excerpt: form.excerpt.trim() || null, content: form.content.trim(), isPublished: form.isPublished }
  try {
    let saved = props.item ? await newsApi.update(props.item.id, payload) : await newsApi.create(payload)
    if (images.value.length) saved = await newsApi.addImages(saved.id, images.value)
    ElMessage.success(form.isPublished ? 'Новость опубликована' : 'Черновик сохранён')
    emit('saved', saved)
    open.value = false
  } catch (e) {
    error.value = errorMessage(e, 'Не удалось сохранить новость')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <el-dialog v-model="open" :title="editing ? 'Редактирование новости' : 'Новая новость'" width="min(720px, 94vw)" align-center>
    <el-form label-position="top" @submit.prevent="save">
      <el-form-item label="Заголовок" required><el-input v-model="form.title" maxlength="200" show-word-limit /></el-form-item>
      <el-form-item label="Подзаголовок"><el-input v-model="form.subtitle" maxlength="200" /></el-form-item>
      <el-form-item label="Краткое описание для ленты"><el-input v-model="form.excerpt" type="textarea" :autosize="{ minRows: 2, maxRows: 4 }" maxlength="2000" /></el-form-item>
      <el-form-item label="Текст" required><el-input v-model="form.content" type="textarea" :autosize="{ minRows: 8, maxRows: 20 }" maxlength="50000" show-word-limit /></el-form-item>
      <el-form-item :label="editing ? 'Добавить изображения' : 'Изображения'">
        <input type="file" accept="image/jpeg,image/png,image/webp" multiple class="text-sm text-muted" @change="pick">
        <p class="mt-1 w-full text-xs text-subtle">До 10 файлов JPG, PNG или WebP, каждый до 6 МБ. Первое изображение станет обложкой.</p>
      </el-form-item>
      <el-form-item><el-switch v-model="form.isPublished" active-text="Опубликовано" inactive-text="Черновик" /></el-form-item>
      <p v-if="error" class="rounded-control bg-danger-soft px-3 py-2 text-sm text-danger" role="alert">{{ error }}</p>
    </el-form>
    <template #footer>
      <el-button @click="open = false">Отмена</el-button>
      <el-button type="primary" :loading="saving" @click="save">Сохранить</el-button>
    </template>
  </el-dialog>
</template>
