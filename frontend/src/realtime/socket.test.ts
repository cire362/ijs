import { beforeEach, describe, expect, test, vi } from 'vitest'

type Handler = (...args: unknown[]) => void
const fake = vi.hoisted(() => ({
  handlers: new Map<string, Handler[]>(),
  emitted: [] as [string, unknown][],
  connected: false,
  connects: 0
}))

vi.mock('socket.io-client', () => ({
  io: () => ({
    get connected () { return fake.connected },
    on (event: string, handler: Handler) { fake.handlers.set(event, [...(fake.handlers.get(event) ?? []), handler]) },
    off () {},
    emit (event: string, payload: unknown) { fake.emitted.push([event, payload]) },
    connect () { fake.connects++ },
    disconnect () { fake.connected = false }
  })
}))
const refresh = vi.hoisted(() => vi.fn())
vi.mock('@/api/http', () => ({ getAccessToken: () => 'token-1', refreshSession: refresh }))

const fire = (event: string, ...args: unknown[]) => fake.handlers.get(event)?.forEach((handler) => handler(...args))

describe('realtime subscriptions', () => {
  beforeEach(() => { fake.emitted.length = 0 })

  test('subscriptions are re-sent after every reconnect and can be removed', async () => {
    const { keepSubscribed } = await import('./socket')
    const stop = keepSubscribed('notifications', (socket, token) => socket.emit('subscribe', { userId: 5, token }))
    expect(fake.emitted).toEqual([])
    fake.connected = true
    fire('connect')
    fire('connect')
    expect(fake.emitted).toEqual([['subscribe', { userId: 5, token: 'token-1' }], ['subscribe', { userId: 5, token: 'token-1' }]])
    stop()
    fire('connect')
    expect(fake.emitted).toHaveLength(2)
  })

  test('a server-side disconnect refreshes the session and reconnects', async () => {
    await import('./socket')
    refresh.mockResolvedValue({ token: 'token-2' })
    const before = fake.connects
    fire('disconnect', 'io server disconnect')
    await vi.waitFor(() => expect(fake.connects).toBe(before + 1))
    expect(refresh).toHaveBeenCalledTimes(1)
    fire('disconnect', 'transport close')
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(refresh).toHaveBeenCalledTimes(1)
  })
})
