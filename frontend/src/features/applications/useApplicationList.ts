import { computed, ref, shallowRef, watch } from 'vue'
import { applicationsApi } from '@/api/endpoints'
import { useRoute, useRouter } from 'vue-router'
import type { Application, ApplicationStatus, Page } from '@/api/types'
import { useAsync } from '@/composables/useAsync'
import { useNotificationsStore } from '@/stores/notifications'

export const PAGE_SIZE = 20

/** Shared state of the application lists: filters in the URL, paging, the opened application and live refresh. */
export function useApplicationList (fetch: (query: { page: number, limit: number, status: ApplicationStatus | '', developerId?: number | null }) => Promise<Page<Application>>) {
  const route = useRoute()
  const router = useRouter()
  const page = ref(Number(route.query.page) || 1)
  const status = ref((route.query.status as ApplicationStatus) || '')
  const developerId = ref<number | null>(Number(route.query.developer) || null)
  const selectedId = ref<number | null>(Number(route.query.app) || null)

  const list = useAsync(() => fetch({ page: page.value, limit: PAGE_SIZE, status: status.value, developerId: developerId.value }), { items: [], total: 0, page: 1, limit: PAGE_SIZE } as Page<Application>)
  // An application linked from a notification may sit on another page; it is then loaded on its own.
  const single = shallowRef<Application | null>(null)
  const selected = computed(() => list.data.value.items.find((item) => item.id === selectedId.value) ?? (single.value?.id === selectedId.value ? single.value : null))

  async function ensureSelected () {
    const id = selectedId.value
    if (!id || list.data.value.items.some((item) => item.id === id)) return
    single.value = await applicationsApi.get(id).catch(() => null)
    if (!single.value && selectedId.value === id) selectedId.value = null
  }

  async function reload () {
    await list.run()
    if (single.value && selectedId.value === single.value.id) single.value = await applicationsApi.get(single.value.id).catch(() => null)
    await ensureSelected()
  }
  const drawer = computed({
    get: () => Boolean(selectedId.value && selected.value),
    set: (value: boolean) => { if (!value) selectedId.value = null }
  })

  function syncQuery () {
    const query: Record<string, string> = {}
    if (page.value > 1) query.page = String(page.value)
    if (status.value) query.status = status.value
    if (developerId.value) query.developer = String(developerId.value)
    if (selectedId.value) query.app = String(selectedId.value)
    void router.replace({ query })
  }

  watch([status, developerId], () => { page.value = 1 })
  watch([page, status, developerId], () => { syncQuery(); void reload() })
  watch(selectedId, () => { syncQuery(); void ensureSelected() })
  void reload()

  // Status changes made elsewhere arrive as notifications; refresh the visible page.
  const stop = useNotificationsStore().onIncoming((note) => {
    if (note.type.startsWith('application_')) void reload()
  })

  function open (application: Application) { selectedId.value = application.id }

  return { ...list, run: reload, page, status, developerId, selectedId, selected, drawer, open, stop }
}
