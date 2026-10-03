import { afterEach, describe, expect, test, vi } from 'vitest'
import type { AxiosAdapter, InternalAxiosRequestConfig } from 'axios'
import { AxiosError } from 'axios'
import { errorMessage, http, onSessionLost, setAccessToken } from './http'

function respond (config: InternalAxiosRequestConfig, status: number, data: unknown) {
  if (status >= 400) {
    return Promise.reject(new AxiosError('fail', String(status), config, null, { status, data, statusText: '', headers: {}, config }))
  }
  return Promise.resolve({ status, data, statusText: 'OK', headers: {}, config })
}

afterEach(() => { setAccessToken(null) })

describe('http', () => {
  test('parallel 401 responses share one refresh and are retried with the new token', async () => {
    setAccessToken('expired')
    let refreshes = 0
    const adapter: AxiosAdapter = (config) => {
      if (config.url === '/auth/refresh') {
        refreshes++
        return respond(config, 200, { token: 'fresh', user: { id: 1 } })
      }
      const auth = config.headers.get('Authorization')
      return auth === 'Bearer fresh' ? respond(config, 200, { ok: config.url }) : respond(config, 401, { error: 'expired' })
    }
    http.defaults.adapter = adapter
    const results = await Promise.all([http.get('/a'), http.get('/b'), http.get('/c')])
    expect(results.map((r) => r.data.ok)).toEqual(['/a', '/b', '/c'])
    expect(refreshes).toBe(1)
  })

  test('a rejected refresh reports a lost session; anonymous 401s do not refresh', async () => {
    const lost = vi.fn()
    onSessionLost(lost)
    setAccessToken('expired')
    http.defaults.adapter = (config) => respond(config, 401, { error: 'Сессия истекла' })
    await expect(http.get('/a')).rejects.toBeInstanceOf(AxiosError)
    expect(lost).toHaveBeenCalledTimes(1)
    const calls: string[] = []
    http.defaults.adapter = (config) => { calls.push(String(config.url)); return respond(config, 401, {}) }
    await expect(http.get('/b')).rejects.toBeInstanceOf(AxiosError)
    expect(calls).toEqual(['/b'])
  })

  test('server messages are shown as is, other failures get a Russian fallback', async () => {
    http.defaults.adapter = (config) => respond(config, 409, { error: 'Объект уже забронирован' })
    expect(errorMessage(await http.get('/x').catch((e) => e))).toBe('Объект уже забронирован')
    http.defaults.adapter = (config) => respond(config, 429, {})
    expect(errorMessage(await http.get('/x').catch((e) => e))).toBe('Слишком много запросов. Попробуйте немного позже')
    const network = new AxiosError('Network Error', 'ERR_NETWORK')
    expect(errorMessage(network)).toMatch(/Нет соединения/)
  })
})
