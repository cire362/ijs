import { io, type Socket } from 'socket.io-client'
import { getAccessToken, refreshSession } from '@/api/http'

type Subscription = (socket: Socket, token: string | null) => void

// Socket.IO lives on the API origin; in production Caddy proxies /socket.io next to the SPA.
function socketUrl () {
  const api = import.meta.env.VITE_API_URL
  return api && /^https?:\/\//.test(api) ? new URL(api).origin : window.location.origin
}

let socket: Socket | null = null
const subscriptions = new Map<string, Subscription>()
let recovering = false

function replay () {
  if (!socket?.connected) return
  const token = getAccessToken()
  for (const subscribe of subscriptions.values()) subscribe(socket, token)
}

// The server closes a socket when its session ends; refresh once and reconnect if the session is still alive.
async function recover () {
  if (recovering || !socket) return
  recovering = true
  try {
    if (getAccessToken()) await refreshSession()
    socket.connect()
  } catch {
    // The HTTP layer reports a lost session; anonymous features reconnect without a token.
    socket.connect()
  } finally {
    recovering = false
  }
}

export function getSocket (): Socket {
  if (!socket) {
    socket = io(socketUrl(), { autoConnect: false, transports: ['websocket', 'polling'], withCredentials: true })
    socket.on('connect', replay)
    socket.on('disconnect', (reason) => { if (reason === 'io server disconnect') void recover() })
    socket.on('auth_expired', () => { void recover() })
    socket.connect()
  }
  return socket
}

/** Registers a room subscription that is re-sent after every (re)connect. Returns an unsubscribe function. */
export function keepSubscribed (key: string, subscribe: Subscription, leave?: (socket: Socket) => void): () => void {
  const current = getSocket()
  subscriptions.set(key, subscribe)
  if (current.connected) subscribe(current, getAccessToken())
  return () => {
    if (subscriptions.get(key) !== subscribe) return
    subscriptions.delete(key)
    if (leave && current.connected) leave(current)
  }
}

export function onSocket<T = unknown> (event: string, handler: (payload: T) => void): () => void {
  const current = getSocket()
  current.on(event, handler)
  return () => { current.off(event, handler) }
}

export function emitSocket (event: string, payload: unknown) {
  getSocket().emit(event, payload)
}

/** Drops all private rooms, e.g. after logout or an account switch. */
export function resetSocket () {
  subscriptions.clear()
  if (!socket) return
  socket.disconnect()
  socket.connect()
}
