<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { IconArrowRight, IconBuildingCommunity, IconCalendarEvent, IconChecks, IconFileText, IconMessages, IconShieldCheck, IconUser } from '@tabler/icons-vue'
import { eventsApi, newsApi, propertiesApi } from '@/api/endpoints'
import type { NewsItem, PlatformEvent, Property } from '@/api/types'
import { homeFor } from '@/router'
import { useAuthStore } from '@/stores/auth'
import { formatDate, formatDateTime } from '@/utils/format'
import { APPLICATION_FLOW, APPLICATION_STATUS, EVENT_FORMAT } from '@/utils/status'
import PropertyCard from '@/components/property/PropertyCard.vue'

const auth = useAuthStore()
const properties = ref<Property[]>([])
const news = ref<NewsItem[]>([])
const events = ref<PlatformEvent[]>([])
const loaded = ref(false)

const featured = computed(() => properties.value.find((item) => item.images?.length) ?? properties.value[0] ?? null)
const strip = computed(() => properties.value.filter((item) => item.id !== featured.value?.id).slice(0, 8))
const catalogLink = '/properties'

type Audience = 'agent' | 'individual' | 'developer'
const audience = ref<Audience>('agent')
const audiences: Record<Audience, { label: string, title: string, text: string, points: { icon: typeof IconUser, text: string }[] }> = {
  agent: {
    label: 'Агентам',
    title: 'Фиксируйте клиента и ведите сделку до комиссии',
    text: 'Заявка закрепляет клиента за вами на объекте. Комиссия рассчитывается по тарифу застройщика в момент подачи.',
    points: [
      { icon: IconShieldCheck, text: 'Клиента на объекте не перехватит другой агент' },
      { icon: IconFileText, text: 'Статус сделки виден на каждом этапе' },
      { icon: IconMessages, text: 'Чат и документы по каждой заявке' }
    ]
  },
  individual: {
    label: 'Покупателям',
    title: 'Выберите дом и забронируйте его напрямую',
    text: 'Заявка уходит застройщику с данными вашего профиля. Ответ и смена статуса приходят уведомлением.',
    points: [
      { icon: IconBuildingCommunity, text: 'Только объекты подтверждённых застройщиков' },
      { icon: IconChecks, text: 'Бронь закрепляется за одной заявкой' },
      { icon: IconMessages, text: 'Вопросы решаются в чате заявки' }
    ]
  },
  developer: {
    label: 'Застройщикам',
    title: 'Получайте заявки от агентов и покупателей',
    text: 'Размещайте дома и участки, задавайте тарифы комиссии и подтверждайте брони в одном окне.',
    points: [
      { icon: IconFileText, text: 'Входящие заявки с историей статусов' },
      { icon: IconShieldCheck, text: 'Бронь и продажа синхронизируются с объектом' },
      { icon: IconCalendarEvent, text: 'Продление срока заявки в один клик' }
    ]
  }
}

onMounted(async () => {
  const [catalog, latestNews, upcoming] = await Promise.allSettled([
    propertiesApi.list({ page: 1, limit: 9, status: 'available' }),
    newsApi.list({ page: 1, limit: 3 }),
    eventsApi.list({ page: 1, limit: 3 })
  ])
  if (catalog.status === 'fulfilled') properties.value = catalog.value.items
  if (latestNews.status === 'fulfilled') news.value = latestNews.value.items
  if (upcoming.status === 'fulfilled') events.value = upcoming.value.items.filter((event) => !event.cancelledAt && new Date(event.startAt) > new Date())
  loaded.value = true
})
</script>

<template>
  <div>
    <!-- Hero: message on the left, a live object from the catalog on the right. -->
    <section class="mx-auto grid max-w-7xl items-center gap-10 px-4 pb-16 pt-10 md:px-8 lg:grid-cols-[1.15fr_0.85fr] lg:pb-24 lg:pt-16">
      <div>
        <h1 class="text-[30px] font-semibold leading-[1.1] tracking-tight text-ink sm:text-4xl md:text-5xl lg:text-[50px]">Дома и участки ИЖС от проверенных застройщиков</h1>
        <p class="mt-5 max-w-[46ch] text-lg text-muted">Каталог, заявки и бронирование в одном кабинете для агентов, покупателей и застройщиков.</p>
        <div class="mt-8 flex flex-wrap gap-3">
          <router-link :to="catalogLink"><el-button type="primary" size="large">Смотреть объекты <IconArrowRight :size="18" class="ml-1.5" /></el-button></router-link>
          <router-link v-if="auth.user" :to="homeFor(auth.role, auth.user.developerApproved)"><el-button size="large">Кабинет</el-button></router-link>
          <router-link v-else to="/login"><el-button size="large">Войти</el-button></router-link>
        </div>
      </div>
      <div class="relative">
        <div v-if="!loaded" class="skeleton aspect-[4/3.4] rounded-surface" />
        <div v-else-if="featured" class="relative mx-auto max-w-[520px] lg:ml-auto">
          <PropertyCard :property="featured" :to="auth.user ? undefined : null" />
        </div>
        <div v-else class="surface grid aspect-[4/3] place-items-center p-8 text-center text-muted">Объекты скоро появятся в каталоге</div>
      </div>
    </section>

    <!-- Audiences: one segmented switch instead of three equal cards. -->
    <section class="border-y border-line bg-surface">
      <div class="mx-auto grid max-w-7xl gap-10 px-4 py-16 md:px-8 lg:grid-cols-[0.8fr_1.2fr] lg:py-20">
        <div v-reveal>
          <h2 class="text-3xl font-semibold text-ink md:text-4xl">Каждый участник видит свою часть сделки</h2>
          <div class="mt-6 inline-flex rounded-control bg-surface-2 p-1" role="tablist" aria-label="Для кого">
            <button v-for="(item, key) in audiences" :key="key" type="button" role="tab" :aria-selected="audience === key" class="rounded-[8px] px-4 py-2 text-sm font-medium transition-colors" :class="audience === key ? 'bg-surface text-ink shadow-soft' : 'text-muted hover:text-ink'" @click="audience = key">{{ item.label }}</button>
          </div>
        </div>
        <div v-reveal="1" class="min-h-[240px]" role="tabpanel">
          <transition mode="out-in" enter-from-class="opacity-0 translate-y-2" leave-to-class="opacity-0" enter-active-class="transition duration-300" leave-active-class="transition duration-150">
            <div :key="audience">
              <h3 class="text-2xl font-semibold text-ink">{{ audiences[audience].title }}</h3>
              <p class="mt-3 max-w-[60ch] text-muted">{{ audiences[audience].text }}</p>
              <ul class="mt-6 grid gap-3 sm:grid-cols-2">
                <li v-for="point in audiences[audience].points" :key="point.text" class="flex items-start gap-3 rounded-control bg-surface-2 p-4">
                  <component :is="point.icon" :size="20" class="mt-0.5 text-accent" />
                  <span class="text-[15px] text-ink">{{ point.text }}</span>
                </li>
              </ul>
            </div>
          </transition>
        </div>
      </div>
    </section>

    <!-- Live catalog strip. -->
    <section v-if="strip.length" class="mx-auto max-w-7xl px-4 py-16 md:px-8 lg:py-20">
      <div v-reveal class="mb-6 flex items-end justify-between gap-4">
        <h2 class="text-3xl font-semibold text-ink">Сейчас в каталоге</h2>
        <router-link :to="catalogLink" class="link hidden shrink-0 items-center gap-1 font-medium sm:inline-flex">Весь каталог <IconArrowRight :size="16" /></router-link>
      </div>
      <div class="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0">
        <div v-for="(item, index) in strip" :key="item.id" v-reveal="index" class="w-[280px] shrink-0 snap-start md:w-[300px]">
          <PropertyCard :property="item" :to="auth.user ? undefined : null" />
        </div>
      </div>
    </section>

    <!-- Deal flow as a timeline. -->
    <section class="mx-auto max-w-7xl px-4 pb-16 md:px-8 lg:pb-20">
      <div v-reveal class="surface overflow-hidden p-6 md:p-10">
        <h2 class="max-w-[24ch] text-3xl font-semibold text-ink">От заявки до комиссии без переписки в мессенджерах</h2>
        <p class="mt-3 max-w-[60ch] text-muted">Заявка действует семь дней. Застройщик подтверждает бронь, остальные статусы ведутся до завершения сделки.</p>
        <ol class="mt-8 grid gap-4 md:grid-cols-6 md:gap-0">
          <li v-for="(status, index) in APPLICATION_FLOW" :key="status" class="relative flex items-center gap-3 md:flex-col md:items-start md:gap-3 md:pr-4">
            <span class="relative z-10 grid size-9 shrink-0 place-items-center rounded-full border-2 text-sm font-semibold tabular" :class="index === APPLICATION_FLOW.length - 1 ? 'border-success bg-success-soft text-success' : 'border-accent bg-surface text-accent'">{{ index + 1 }}</span>
            <span v-if="index < APPLICATION_FLOW.length - 1" class="absolute left-9 right-0 top-[17px] hidden h-0.5 bg-line md:block" aria-hidden="true" />
            <span class="text-[15px] font-medium text-ink">{{ APPLICATION_STATUS[status].label }}</span>
          </li>
        </ol>
      </div>
    </section>

    <!-- News and events side by side. -->
    <section v-if="news.length || events.length" class="border-t border-line bg-surface">
      <div class="mx-auto grid max-w-7xl gap-12 px-4 py-16 md:px-8 lg:grid-cols-[1.3fr_1fr] lg:py-20">
        <div v-if="news.length" v-reveal>
          <div class="mb-6 flex items-end justify-between">
            <h2 class="text-2xl font-semibold text-ink">Новости</h2>
            <router-link to="/news" class="link text-sm font-medium">Все новости</router-link>
          </div>
          <router-link v-for="item in news" :key="item.id" :to="`/news/${item.id}`" class="group flex gap-4 border-t border-line py-5 first:border-t-0 first:pt-0">
            <img v-if="item.images?.[0]" :src="item.images[0].url" alt="" loading="lazy" class="hidden size-24 shrink-0 rounded-control object-cover sm:block">
            <div class="min-w-0">
              <p class="text-xs text-subtle">{{ formatDate(item.publishedAt || item.createdAt) }}</p>
              <h3 class="mt-1 text-lg font-semibold text-ink group-hover:text-accent">{{ item.title }}</h3>
              <p v-if="item.excerpt || item.subtitle" class="mt-1 line-clamp-2 text-sm text-muted">{{ item.excerpt || item.subtitle }}</p>
            </div>
          </router-link>
        </div>
        <div v-if="events.length" v-reveal="1">
          <div class="mb-6 flex items-end justify-between">
            <h2 class="text-2xl font-semibold text-ink">Ближайшие мероприятия</h2>
            <router-link to="/events" class="link text-sm font-medium">Все</router-link>
          </div>
          <ul class="flex flex-col gap-3">
            <li v-for="event in events" :key="event.id" class="flex gap-4 rounded-surface bg-surface-2 p-4">
              <span class="grid w-14 shrink-0 place-items-center rounded-control bg-surface py-2 text-center">
                <span class="text-xl font-semibold leading-none text-ink tabular">{{ new Date(event.startAt).getDate() }}</span>
                <span class="mt-1 text-xs text-muted">{{ new Date(event.startAt).toLocaleDateString('ru-RU', { month: 'short' }) }}</span>
              </span>
              <span class="min-w-0">
                <span class="block font-medium text-ink">{{ event.title }}</span>
                <span class="mt-0.5 block text-sm text-muted">{{ formatDateTime(event.startAt) }}<template v-if="event.format">, {{ EVENT_FORMAT[event.format].toLowerCase() }}</template></span>
              </span>
            </li>
          </ul>
        </div>
      </div>
    </section>

    <!-- Closing call to action. -->
    <section v-if="!auth.user" class="mx-auto max-w-7xl px-4 py-16 md:px-8">
      <div v-reveal class="flex flex-col items-start justify-between gap-6 rounded-surface bg-accent px-6 py-10 text-accent-contrast md:flex-row md:items-center md:px-12">
        <div>
          <h2 class="text-3xl font-semibold">Начните работу с каталогом</h2>
          <p class="mt-2 max-w-[52ch] opacity-85">Регистрация занимает пару минут. Застройщиков проверяет администратор.</p>
        </div>
        <router-link to="/register"><el-button size="large" class="!border-transparent !bg-accent-contrast !text-accent">Создать аккаунт</el-button></router-link>
      </div>
    </section>
  </div>
</template>
