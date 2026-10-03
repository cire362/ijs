<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { IconFileText, IconPaperclip, IconSend2, IconX } from '@tabler/icons-vue'
import { applicationsApi } from '@/api/endpoints'
import { errorMessage } from '@/api/http'
import type { ApplicationChatMessage } from '@/api/types'
import { keepSubscribed, onSocket } from '@/realtime/socket'
import { useAuthStore } from '@/stores/auth'
import { formatFileSize, formatShortDateTime, personName } from '@/utils/format'
import { ROLE_LABEL } from '@/utils/status'

const props = defineProps<{ applicationId: number }>()
const emit = defineEmits<{ message: [message: ApplicationChatMessage] }>()
const PAGE = 50
const ALLOWED = '.pdf,.doc,.docx'

const auth = useAuthStore()
const messages = ref<ApplicationChatMessage[]>([])
const loading = ref(false)
const loadingOlder = ref(false)
const hasOlder = ref(false)
const error = ref('')
const draft = ref('')
const file = ref<File | null>(null)
const sending = ref(false)
const list = ref<HTMLElement | null>(null)
const picker = ref<HTMLInputElement | null>(null)

const canSend = computed(() => Boolean(draft.value.trim() || file.value) && !sending.value)

function scrollDown () {
  void nextTick(() => list.value?.scrollTo({ top: list.value.scrollHeight }))
}

function append (message: ApplicationChatMessage) {
  if (messages.value.some((item) => item.id === message.id)) return
  messages.value.push(message)
  scrollDown()
}

async function load () {
  loading.value = true
  error.value = ''
  try {
    const page = await applicationsApi.messages(props.applicationId, { limit: PAGE })
    messages.value = page
    hasOlder.value = page.length === PAGE
    scrollDown()
  } catch (e) {
    error.value = errorMessage(e, 'Не удалось загрузить переписку')
  } finally {
    loading.value = false
  }
}

async function loadOlder () {
  const first = messages.value[0]
  if (!first || loadingOlder.value) return
  loadingOlder.value = true
  const height = list.value?.scrollHeight ?? 0
  try {
    const older = await applicationsApi.messages(props.applicationId, { limit: PAGE, beforeId: first.id })
    messages.value = [...older, ...messages.value]
    hasOlder.value = older.length === PAGE
    void nextTick(() => { if (list.value) list.value.scrollTop = list.value.scrollHeight - height })
  } catch (e) {
    ElMessage.error(errorMessage(e))
  } finally {
    loadingOlder.value = false
  }
}

let stopRoom: (() => void) | null = null
watch(() => props.applicationId, (id) => {
  stopRoom?.()
  messages.value = []
  void load()
  stopRoom = keepSubscribed(`application-chat:${id}`,
    (socket, token) => socket.emit('application_chat_join', { applicationId: id, token }),
    (socket) => socket.emit('application_chat_leave', { applicationId: id }))
}, { immediate: true })

const stopListen = onSocket<{ applicationId: number, message: ApplicationChatMessage }>('application_chat_message', (payload) => {
  if (payload.applicationId === props.applicationId) append(payload.message)
})
onBeforeUnmount(() => { stopRoom?.(); stopListen() })

function pick (event: Event) {
  const selected = (event.target as HTMLInputElement).files?.[0] ?? null
  if (selected && selected.size > 15 * 1024 * 1024) {
    ElMessage.error('Файл больше 15 МБ')
    return
  }
  file.value = selected
}

async function send () {
  if (!canSend.value) return
  sending.value = true
  try {
    const message = await applicationsApi.sendMessage(props.applicationId, draft.value.trim(), file.value)
    append(message)
    emit('message', message)
    draft.value = ''
    file.value = null
    if (picker.value) picker.value.value = ''
  } catch (e) {
    ElMessage.error(errorMessage(e, 'Сообщение не отправлено'))
  } finally {
    sending.value = false
  }
}

function mine (message: ApplicationChatMessage) {
  return message.senderId === auth.user?.id
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col">
    <div ref="list" class="flex flex-1 flex-col gap-3 overflow-y-auto px-1 py-3" aria-live="polite">
      <div v-if="hasOlder" class="text-center">
        <el-button size="small" text :loading="loadingOlder" @click="loadOlder">Показать раньше</el-button>
      </div>
      <div v-if="loading" class="flex flex-col gap-3">
        <div v-for="i in 3" :key="i" class="skeleton h-14 w-3/5 rounded-surface" :class="i % 2 ? 'self-start' : 'self-end'" />
      </div>
      <p v-else-if="error" class="py-6 text-center text-sm text-danger">{{ error }} <button type="button" class="link" @click="load">Повторить</button></p>
      <p v-else-if="!messages.length" class="py-10 text-center text-sm text-muted">Сообщений пока нет. Задайте вопрос по заявке, вам ответит администратор.</p>
      <div v-for="message in messages" :key="message.id" class="flex flex-col" :class="mine(message) ? 'items-end' : 'items-start'">
        <span v-if="!mine(message)" class="mb-0.5 px-1 text-xs text-muted">{{ personName(message.sender, ROLE_LABEL[message.senderRole]) }}<template v-if="message.senderRole === 'admin'"> (администратор)</template></span>
        <div class="max-w-[80%] rounded-surface px-3.5 py-2.5 text-[15px]" :class="mine(message) ? 'rounded-br-[4px] bg-accent text-accent-contrast' : 'rounded-bl-[4px] bg-surface-2 text-ink'">
          <p v-if="message.text" class="whitespace-pre-wrap break-words">{{ message.text }}</p>
          <a v-if="message.attachmentUrl" :href="message.attachmentUrl" class="mt-1 flex items-center gap-2 rounded-control px-2 py-1.5 text-sm underline-offset-2 hover:underline" :class="mine(message) ? 'bg-[rgb(255_255_255/0.14)]' : 'bg-surface'">
            <IconFileText :size="18" />
            <span class="truncate">{{ message.attachmentOriginalName || 'Документ' }}</span>
            <span class="shrink-0 opacity-75">{{ formatFileSize(message.attachmentSize) }}</span>
          </a>
        </div>
        <span class="mt-0.5 px-1 text-[11px] text-subtle">{{ formatShortDateTime(message.createdAt) }}</span>
      </div>
    </div>
    <form class="border-t border-line pt-3" @submit.prevent="send">
      <div v-if="file" class="mb-2 flex items-center gap-2 rounded-control bg-surface-2 px-3 py-2 text-sm">
        <IconFileText :size="17" class="text-accent" />
        <span class="truncate text-ink">{{ file.name }}</span>
        <span class="text-subtle">{{ formatFileSize(file.size) }}</span>
        <button type="button" class="ml-auto text-subtle hover:text-ink" aria-label="Убрать файл" @click="file = null"><IconX :size="16" /></button>
      </div>
      <div class="flex items-end gap-2">
        <input ref="picker" type="file" :accept="ALLOWED" class="hidden" @change="pick">
        <el-tooltip content="Приложить PDF или Word до 15 МБ" placement="top">
          <el-button aria-label="Приложить файл" class="!px-3" @click="picker?.click()"><IconPaperclip :size="18" /></el-button>
        </el-tooltip>
        <el-input v-model="draft" type="textarea" :autosize="{ minRows: 1, maxRows: 5 }" resize="none" maxlength="5000" placeholder="Сообщение" aria-label="Сообщение" @keydown.enter.exact.prevent="send" />
        <el-button type="primary" native-type="submit" :disabled="!canSend" :loading="sending" aria-label="Отправить" class="!px-3"><IconSend2 :size="18" /></el-button>
      </div>
    </form>
  </div>
</template>
