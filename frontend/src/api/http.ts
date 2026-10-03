import axios, { AxiosError, type AxiosRequestConfig, type InternalAxiosRequestConfig } from 'axios'
import type { User } from './types'

export const API_BASE = import.meta.env.VITE_API_URL || '/api'

export const http = axios.create({ baseURL: API_BASE, withCredentials: true, timeout: 30000 })

interface RefreshResult { token: string, user: User }

let accessToken: string | null = null
let refreshing: Promise<RefreshResult> | null = null
const listeners = { refreshed: [] as ((result: RefreshResult) => void)[], lost: [] as (() => void)[] }

export function setAccessToken (token: string | null) { accessToken = token }
export function getAccessToken () { return accessToken }
export function onSessionRefreshed (fn: (result: RefreshResult) => void) { listeners.refreshed.push(fn) }
export function onSessionLost (fn: () => void) { listeners.lost.push(fn) }

export function readCookie (name: string): string | null {
  for (const part of document.cookie.split(';')) {
    const [key, ...rest] = part.trim().split('=')
    if (key && decodeURIComponent(key) === name) return decodeURIComponent(rest.join('='))
  }
  return null
}

// Cookie-authenticated endpoints require the double-submit CSRF header.
export function csrfHeaders (): Record<string, string> {
  const token = readCookie('csrf_token')
  return token ? { 'x-csrf-token': token } : {}
}

// One refresh at a time: parallel 401s wait for the same rotation.
export function refreshSession (): Promise<RefreshResult> {
  refreshing ??= http
    .post<RefreshResult>('/auth/refresh', null, { headers: csrfHeaders(), skipAuthRefresh: true } as AxiosRequestConfig)
    .then(({ data }) => {
      setAccessToken(data.token)
      listeners.refreshed.forEach((fn) => fn(data))
      return data
    })
    .finally(() => { refreshing = null })
  return refreshing
}

declare module 'axios' {
  interface AxiosRequestConfig { skipAuthRefresh?: boolean, retried?: boolean }
}

http.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (accessToken && !config.headers.has('Authorization')) config.headers.set('Authorization', `Bearer ${accessToken}`)
  return config
})

http.interceptors.response.use(undefined, async (error: AxiosError) => {
  const config = error.config
  if (error.response?.status !== 401 || !config || config.skipAuthRefresh || config.retried || !accessToken) {
    throw error
  }
  try {
    const { token } = await refreshSession()
    config.retried = true
    config.headers.set('Authorization', `Bearer ${token}`)
    return http.request(config)
  } catch (refreshError) {
    // Only a rejected refresh means the session is gone; network failures keep the user signed in.
    if ((refreshError as AxiosError).response?.status === 401) {
      setAccessToken(null)
      listeners.lost.forEach((fn) => fn())
    }
    throw error
  }
})

const STATUS_MESSAGES: Record<number, string> = {
  400: 'Проверьте введённые данные',
  401: 'Войдите в аккаунт, чтобы продолжить',
  403: 'Недостаточно прав для этого действия',
  404: 'Не найдено',
  409: 'Действие недоступно в текущем состоянии',
  413: 'Файл слишком большой',
  429: 'Слишком много запросов. Попробуйте немного позже',
  503: 'Сервис временно недоступен'
}

// The backend returns Russian messages in `error`; fall back to a status-based text.
export function errorMessage (error: unknown, fallback = 'Что-то пошло не так. Попробуйте ещё раз'): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { error?: unknown } | undefined
    if (typeof data?.error === 'string' && data.error.trim()) return data.error
    if (!error.response) return 'Нет соединения с сервером. Проверьте интернет и попробуйте снова'
    return STATUS_MESSAGES[error.response.status] ?? fallback
  }
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string' && error.message) {
    return error.message
  }
  return fallback
}

export function errorStatus (error: unknown): number | null {
  return axios.isAxiosError(error) ? error.response?.status ?? null : null
}
