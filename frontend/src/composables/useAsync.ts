import { ref, shallowRef } from 'vue'
import { errorMessage } from '@/api/http'

/** Tracks loading and error state of a reloadable request; stale responses are ignored. */
export function useAsync<T, A extends unknown[]> (loader: (...args: A) => Promise<T>, initial: T) {
  const data = shallowRef<T>(initial)
  const loading = ref(false)
  const error = ref('')
  let ticket = 0

  async function run (...args: A): Promise<T | undefined> {
    const current = ++ticket
    loading.value = true
    error.value = ''
    try {
      const result = await loader(...args)
      if (current === ticket) data.value = result
      return result
    } catch (e) {
      if (current === ticket) error.value = errorMessage(e, 'Не удалось загрузить данные')
      return undefined
    } finally {
      if (current === ticket) loading.value = false
    }
  }

  return { data, loading, error, run }
}
