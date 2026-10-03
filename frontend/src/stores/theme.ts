import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export type ThemeMode = 'system' | 'light' | 'dark'
const KEY = 'ijs-theme'

function readMode (): ThemeMode {
  try {
    const saved = localStorage.getItem(KEY)
    return saved === 'light' || saved === 'dark' ? saved : 'system'
  } catch {
    return 'system'
  }
}

export const useThemeStore = defineStore('theme', () => {
  const mode = ref<ThemeMode>(readMode())
  const media = window.matchMedia('(prefers-color-scheme: dark)')
  const isDark = ref(false)

  function apply () {
    isDark.value = mode.value === 'dark' || (mode.value === 'system' && media.matches)
    document.documentElement.classList.toggle('dark', isDark.value)
  }

  watch(mode, (value) => {
    try {
      if (value === 'system') localStorage.removeItem(KEY)
      else localStorage.setItem(KEY, value)
    } catch { /* storage may be unavailable */ }
    apply()
  })
  media.addEventListener('change', apply)
  apply()

  function cycle () {
    mode.value = mode.value === 'system' ? 'light' : mode.value === 'light' ? 'dark' : 'system'
  }

  return { mode, isDark, cycle }
})
