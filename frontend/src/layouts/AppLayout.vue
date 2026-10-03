<script setup lang="ts">
import { computed, ref, watch, type Component } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  IconBuildingCommunity, IconCalendarEvent, IconChevronDown, IconFileText, IconHistory, IconHome2, IconInbox,
  IconLifebuoy, IconLogout, IconMenu2, IconMessages, IconNews, IconPercentage, IconUserCircle, IconBell
} from '@tabler/icons-vue'
import { ElMessageBox } from 'element-plus'
import type { Role } from '@/api/types'
import { useAuthStore } from '@/stores/auth'
import { useNotificationsStore } from '@/stores/notifications'
import { ROLE_LABEL } from '@/utils/status'
import { personName } from '@/utils/format'
import AppLogo from '@/components/AppLogo.vue'
import ThemeToggle from '@/components/ThemeToggle.vue'
import NotificationBell from '@/components/NotificationBell.vue'
import UserAvatar from '@/components/UserAvatar.vue'

interface NavItem { to: string, label: string, icon: Component, roles?: Role[], approved?: boolean }

const auth = useAuthStore()
const notifications = useNotificationsStore()
const route = useRoute()
const router = useRouter()
const drawer = ref(false)

const catalogLabel = computed(() => auth.isDeveloper ? 'Мои объекты' : auth.isAdmin ? 'Объекты' : 'Каталог')

const sections = computed(() => ([
  {
    items: [
      { to: '/properties', label: catalogLabel.value, icon: IconHome2 },
      { to: '/applications', label: 'Мои заявки', icon: IconFileText, roles: ['agent', 'individual'] },
      { to: '/incoming', label: 'Входящие заявки', icon: IconInbox, roles: ['developer', 'admin'], approved: true },
      { to: '/application-chats', label: 'Чаты по заявкам', icon: IconMessages, roles: ['agent', 'individual', 'admin'] },
      { to: '/tariffs', label: 'Тарифы', icon: IconPercentage, roles: ['agent', 'developer', 'admin'], approved: true }
    ]
  },
  {
    title: 'Сообщество',
    items: [
      { to: '/events', label: 'Мероприятия', icon: IconCalendarEvent, roles: ['agent', 'individual', 'developer'] },
      { to: '/news', label: 'Новости', icon: IconNews }
    ]
  },
  {
    title: 'Администрирование',
    items: [
      { to: '/admin/chat', label: 'Поддержка', icon: IconLifebuoy, roles: ['admin'] },
      { to: '/admin/developers', label: 'Застройщики', icon: IconBuildingCommunity, roles: ['admin'] },
      { to: '/admin/events', label: 'Мероприятия', icon: IconCalendarEvent, roles: ['admin'] },
      { to: '/admin/audit', label: 'Журнал изменений', icon: IconHistory, roles: ['admin'] }
    ]
  }
] as { title?: string, items: NavItem[] }[]).map((section) => ({
  ...section,
  items: section.items.filter((item) => (!item.roles || (auth.role && item.roles.includes(auth.role))) && (!item.approved || !auth.isPendingDeveloper))
})).filter((section) => section.items.length))

function isActive (to: string) {
  return route.path === to || route.path.startsWith(`${to}/`)
}

watch(() => route.fullPath, () => { drawer.value = false })

async function logout (everywhere: boolean) {
  if (everywhere) {
    try {
      await ElMessageBox.confirm('Все устройства, где выполнен вход, потребуют войти заново.', 'Выйти на всех устройствах?', { confirmButtonText: 'Выйти везде', cancelButtonText: 'Отмена', type: 'warning' })
    } catch { return }
  }
  await auth.logout(everywhere).catch(() => {})
  await router.push('/login')
}
</script>

<template>
  <div class="min-h-[100dvh] lg:grid lg:grid-cols-[260px_1fr]">
    <!-- Sidebar: fixed column on desktop, drawer on smaller screens. -->
    <aside class="fixed inset-y-0 left-0 z-40 flex w-[272px] flex-col border-r border-line bg-surface transition-transform duration-200 lg:sticky lg:top-0 lg:z-auto lg:h-[100dvh] lg:w-auto lg:translate-x-0" :class="drawer ? 'translate-x-0 shadow-soft' : '-translate-x-full'" aria-label="Меню кабинета">
      <div class="flex h-16 items-center px-5">
        <AppLogo :to="'/properties'" />
      </div>
      <nav class="flex-1 overflow-y-auto px-3 pb-4">
        <div v-for="(section, index) in sections" :key="index" class="mt-4 first:mt-1">
          <p v-if="section.title" class="px-3 pb-1.5 text-xs font-medium text-subtle">{{ section.title }}</p>
          <router-link v-for="item in section.items" :key="item.to" :to="item.to" class="mb-0.5 flex items-center gap-3 rounded-control px-3 py-2 text-[15px] transition-colors" :class="isActive(item.to) ? 'bg-accent-soft font-medium text-accent' : 'text-muted hover:bg-surface-2 hover:text-ink'" :aria-current="isActive(item.to) ? 'page' : undefined">
            <component :is="item.icon" :size="19" />
            {{ item.label }}
          </router-link>
        </div>
      </nav>
      <div class="border-t border-line p-3">
        <router-link to="/notifications" class="flex items-center gap-3 rounded-control px-3 py-2 text-[15px]" :class="isActive('/notifications') ? 'bg-accent-soft font-medium text-accent' : 'text-muted hover:bg-surface-2 hover:text-ink'">
          <IconBell :size="19" />
          Уведомления
          <span v-if="notifications.unread" class="ml-auto rounded-full bg-accent px-2 text-xs font-semibold leading-5 text-accent-contrast tabular">{{ notifications.unread }}</span>
        </router-link>
        <router-link to="/profile" class="flex items-center gap-3 rounded-control px-3 py-2 text-[15px]" :class="isActive('/profile') ? 'bg-accent-soft font-medium text-accent' : 'text-muted hover:bg-surface-2 hover:text-ink'">
          <IconUserCircle :size="19" />
          Профиль
        </router-link>
      </div>
    </aside>
    <div v-if="drawer" class="fixed inset-0 z-30 bg-[rgb(12_16_22/0.45)] lg:hidden" aria-hidden="true" @click="drawer = false" />

    <div class="flex min-w-0 flex-col">
      <header class="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line bg-[color-mix(in_srgb,var(--bg)_88%,transparent)] px-4 backdrop-blur-md md:px-8">
        <button type="button" class="grid size-9 place-items-center rounded-control text-ink lg:hidden" aria-label="Открыть меню" @click="drawer = true"><IconMenu2 :size="22" /></button>
        <AppLogo compact class="lg:hidden" :to="'/properties'" />
        <div class="ml-auto flex items-center gap-1.5">
          <ThemeToggle />
          <NotificationBell />
          <el-dropdown trigger="click" placement="bottom-end">
            <button type="button" class="ml-1 flex items-center gap-2.5 rounded-control py-1 pl-1 pr-2 hover:bg-surface-2">
              <UserAvatar :person="auth.user" :src="auth.user?.avatarUrl" :size="32" />
              <span class="hidden text-left sm:block">
                <span class="block max-w-[180px] truncate text-sm font-medium leading-tight text-ink">{{ personName(auth.user, 'Профиль') }}</span>
                <span class="block text-xs leading-tight text-subtle">{{ ROLE_LABEL[auth.role ?? ''] }}</span>
              </span>
              <IconChevronDown :size="16" class="hidden text-subtle sm:block" />
            </button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item @click="router.push('/profile')">Профиль</el-dropdown-item>
                <el-dropdown-item @click="router.push('/')">Главная страница</el-dropdown-item>
                <el-dropdown-item divided @click="logout(false)"><IconLogout :size="16" class="mr-2" />Выйти</el-dropdown-item>
                <el-dropdown-item @click="logout(true)">Выйти на всех устройствах</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </header>

      <div v-if="auth.isPendingDeveloper" class="border-b border-line bg-warning-soft px-4 py-3 text-sm text-ink md:px-8">
        Аккаунт застройщика ожидает подтверждения администратора. Пока можно заполнить профиль; объекты и заявки откроются после проверки.
      </div>

      <main class="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 md:px-8 md:py-8">
        <slot />
      </main>
    </div>
  </div>
</template>
