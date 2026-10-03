<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { IconBell, IconChecks } from '@tabler/icons-vue'
import type { AppNotification } from '@/api/types'
import { useAuthStore } from '@/stores/auth'
import { useNotificationsStore } from '@/stores/notifications'
import { formatRelative } from '@/utils/format'
import { notificationLink } from '@/utils/notificationLink'

const store = useNotificationsStore()
const auth = useAuthStore()
const router = useRouter()
const open = ref(false)

async function openNote (note: AppNotification) {
  open.value = false
  await store.markRead(note).catch(() => {})
  const target = notificationLink(note, auth.role)
  await router.push(target ?? '/notifications')
}
</script>

<template>
  <el-popover v-model:visible="open" placement="bottom-end" :width="360" trigger="click" :show-arrow="false" popper-class="!p-0 !rounded-surface">
    <template #reference>
      <button type="button" class="press relative grid size-9 place-items-center rounded-control text-muted transition-colors hover:bg-surface-2 hover:text-ink" :aria-label="store.unread ? `Уведомления, непрочитанных: ${store.unread}` : 'Уведомления'">
        <IconBell :size="20" />
        <span v-if="store.unread" class="absolute right-1 top-1 min-w-[18px] rounded-full bg-accent px-1 text-center text-[11px] font-semibold leading-[18px] text-accent-contrast tabular">{{ store.unread > 99 ? '99+' : store.unread }}</span>
      </button>
    </template>
    <div class="flex items-center justify-between border-b border-line px-4 py-3">
      <span class="font-semibold text-ink">Уведомления</span>
      <router-link to="/notifications" class="link text-sm" @click="open = false">Все</router-link>
    </div>
    <div v-if="!store.latest.length" class="flex flex-col items-center gap-2 px-6 py-10 text-center text-sm text-muted">
      <IconChecks :size="22" />
      Новых уведомлений нет
    </div>
    <ul v-else class="max-h-[420px] overflow-y-auto py-1">
      <li v-for="note in store.latest" :key="note.id">
        <button type="button" class="flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-2" @click="openNote(note)">
          <span class="mt-2 size-1.5 shrink-0 rounded-full" :class="note.isRead ? 'bg-transparent' : 'bg-accent'" aria-hidden="true" />
          <span class="min-w-0">
            <span class="block text-sm text-ink" :class="{ 'font-medium': !note.isRead }">{{ note.text }}</span>
            <span class="mt-0.5 block text-xs text-subtle">{{ formatRelative(note.createdAt) }}</span>
          </span>
        </button>
      </li>
    </ul>
  </el-popover>
</template>
