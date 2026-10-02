const { Server } = require('socket.io')
const { Application } = require('../models')
const { setIO } = require('../socket')
const { getSessionUser, getActiveSession } = require('../utils/sessionUser')
const { canAccessApplicationChat } = require('../services/applicationChatService')
const { getSocketCorsOptions } = require('../utils/cors')
const { verifyGuestSupportSession } = require('../utils/guestSupportSession')
const { saveSupportMessage, saveSupportReply } = require('../services/supportChatService')
const { parseOptionalPositiveInt } = require('../utils/validation')
const { state } = require('../ops/state')
const { createClientIpResolver } = require('../utils/clientIp')
const logger = require('../utils/logger')

function createRealtimeServer (server, { maxEvents = 120, maxIpEvents = 2000, windowMs = 60000, sessionCheckMs = 30000 } = {}) {
  const cors = getSocketCorsOptions()
  const io = new Server(server, {
    cors,
    maxHttpBufferSize: 64 * 1024,
    allowRequest: (request, callback) => cors.origin(request.headers.origin, (error, allowed) => callback(null, !error && allowed))
  })
  setIO(io)
  const ipLimits = new Map()
  const resolveIp = createClientIpResolver()
  io.pendingOperations = new Set()
  function spend (state, max) {
    if (Date.now() >= state.until) { state.until = Date.now() + windowMs; state.count = 0 }
    return ++state.count <= max
  }
  function clearIdentity (socket) {
    clearTimeout(socket.data.expiryTimer)
    for (const room of socket.rooms) { if (room !== socket.id) socket.leave(room) }
    socket.data.identity = null
  }
  // A socket lives as long as its server session: access tokens are short-lived and refreshed over HTTP,
  // so their expiry must not drop the connection. Revocation is detected by the periodic session check.
  function bindIdentity (socket, identity, expiresAt, sessionId = null) {
    if (socket.data.identity !== identity) clearIdentity(socket)
    socket.data.identity = identity
    socket.data.sessionId = sessionId
    clearTimeout(socket.data.expiryTimer)
    const arm = () => {
      const remaining = expiresAt - Date.now()
      if (remaining <= 0) { socket.emit('auth_expired'); socket.disconnect(true); return }
      socket.data.expiryTimer = setTimeout(arm, Math.min(remaining, 2147483647))
      socket.data.expiryTimer.unref?.()
    }
    arm()
  }

  async function getUserFromToken (token, socket) {
    if (!token) return null
    const session = await getSessionUser(token, { expiredSessionId: socket.data.sessionId })
    // A rejected token grants nothing new; rooms of a still active session are kept.
    if (!session) return null
    bindIdentity(socket, `session:${session.sessionId}`, session.sessionExpiresAt.getTime(), session.sessionId)
    socket.join(`session:${session.sessionId}`)
    return session.user
  }

  function parseSocketPayload (payload) {
    if (payload && typeof payload === 'object') return payload
    return { roomId: payload }
  }

  function resolveSupportRoomId ({ requestedRoomId, guestToken, user }) {
    if (user) {
      return `user:${user.id}`
    }

    const guestSession = verifyGuestSupportSession(guestToken)
    if (!guestSession) return null

    const normalized = String(requestedRoomId || '').trim()
    if (normalized && normalized !== guestSession.roomId) {
      return null
    }

    return guestSession.roomId
  }

  io.on('connection', (socket) => {
    const perSocket = { until: 0, count: 0 }
    const ip = resolveIp(socket.request)
    if (!ipLimits.has(ip)) {
      for (const [address, state] of ipLimits) { if (Date.now() >= state.until) ipLimits.delete(address) }
      if (ipLimits.size >= 10000) { socket.disconnect(true); return }
      ipLimits.set(ip, { until: 0, count: 0 })
    }
    socket.use((packet, next) => {
      if (!ipLimits.has(ip)) ipLimits.set(ip, { until: 0, count: 0 })
      if (!spend(perSocket, maxEvents) || !spend(ipLimits.get(ip), maxIpEvents)) {
        const error = { code: 'rate_limit', message: 'Слишком много сообщений, попробуйте позже' }
        socket.emit('rate_limit', error)
        const ack = packet[packet.length - 1]
        if (typeof ack === 'function') ack(error)
        return
      }
      next()
    })
    let pending = Promise.resolve()
    const on = (event, handler) => socket.on(event, (...args) => {
      const ack = typeof args[args.length - 1] === 'function' ? args.pop() : null
      pending = pending.then(async () => {
        if (!socket.connected || state.shuttingDown) { if (ack) ack({ processed: false, error: 'shutting_down' }); return }
        await handler(...args)
        if (ack) ack({ processed: true })
      }).catch((error) => {
        logger.error('socket_event_failed', { event, error })
        socket.emit('message_sent', { status: 'error', message: 'Не удалось обработать запрос' })
        if (ack) ack({ processed: false, error: 'request_failed' })
      })
      const operation = pending
      io.pendingOperations.add(operation)
      operation.finally(() => io.pendingOperations.delete(operation))
    })
    const recheck = setInterval(async () => {
      if (!socket.data.sessionId || socket.data.checking) return
      socket.data.checking = true
      try {
        const sessionId = socket.data.sessionId
        const active = await getActiveSession(sessionId)
        if (!active) socket.disconnect(true)
        // A refresh extends the session; follow its new expiry.
        else if (socket.connected && socket.data.sessionId === sessionId) bindIdentity(socket, socket.data.identity, active.sessionExpiresAt.getTime(), sessionId)
      } catch (error) {
        logger.error('socket_session_check_failed', error)
        socket.disconnect(true)
      } finally { socket.data.checking = false }
    }, sessionCheckMs)
    recheck.unref?.()
    socket.on('disconnect', () => { clearInterval(recheck); clearTimeout(socket.data.expiryTimer) })
    on('subscribe', async (payload) => {
      const data = payload && typeof payload === 'object' ? payload : {}
      const requestedUserId = parseOptionalPositiveInt(data.userId, { max: 2147483647 })
      if (!requestedUserId) return

      const user = await getUserFromToken(data.token, socket)
      if (!user) return
      if (user.role !== 'admin' && user.id !== requestedUserId) return

      socket.join(`user:${requestedUserId}`)
    })

    // Admin joins the admin room
    on('admin_subscribe', async (payload) => {
      const user = await getUserFromToken(payload?.token, socket)
      if (!user || user.role !== 'admin') return
      socket.join('admins')
    })

    // Admin room for application chats (all applications)
    on('application_admin_subscribe', async (payload) => {
      try {
        const token = payload?.token
        const user = await getUserFromToken(token, socket)
        if (!user || user.role !== 'admin') return
        socket.join('application_admins')
        socket.emit('application_admin_subscribed', { ok: true })
      } catch (e) {
        logger.error('application_admin_subscribe_failed', e)
      }
    })

    on('chat_message', async (msg) => {
      const tokenUser = await getUserFromToken(msg?.token, socket)
      const roomId = resolveSupportRoomId({
        requestedRoomId: msg?.roomId,
        guestToken: msg?.guestToken,
        user: tokenUser
      })

      if (!roomId || (msg?.token && !tokenUser)) {
        socket.emit('support_auth_error', {
          code: 'invalid_guest_session',
          message: 'Недействительная guest-сессия поддержки'
        })
        return
      }

      try {
        if (!tokenUser) {
          const guest = verifyGuestSupportSession(msg?.guestToken)
          bindIdentity(socket, guest.roomId, guest.expiresAt.getTime())
        }
        const message = await saveSupportMessage(roomId, msg, tokenUser)
        io.to('admins').emit('new_support_message', message)

        // Confirm to user
        socket.emit('message_sent', { status: 'ok' })
      } catch (e) {
        logger.error('chat_message_failed', e)
        socket.emit('message_sent', { status: 'error', message: e.status === 400 ? e.message : 'Не удалось отправить сообщение' })
      }
    })

    on('admin_reply', async (msg) => {
      try {
        const user = await getUserFromToken(msg?.token, socket)
        if (!user || user.role !== 'admin') return

        const reply = await saveSupportReply(msg, user)
        io.to(reply.roomId).emit('chat_message', reply)
      } catch (e) {
        logger.error('admin_reply_failed', e)
        socket.emit('message_sent', { status: 'error', message: e.status === 400 ? e.message : 'Не удалось отправить сообщение' })
      }
    })

    on('join_room', async (payload) => {
      const data = parseSocketPayload(payload)
      const roomId = String(data?.roomId || '').trim()
      if (!roomId) return

      if (/^user:\d+$/.test(roomId)) {
        const user = await getUserFromToken(data?.token, socket)
        const userId = parseInt(roomId.split(':')[1], 10)
        if (!user || !Number.isFinite(userId)) return
        if (user.role !== 'admin' && user.id !== userId) return
        socket.join(roomId)
        return
      }

      if (roomId === 'admins' || roomId === 'application_admins') {
        const user = await getUserFromToken(data?.token, socket)
        if (!user || user.role !== 'admin') return
        socket.join(roomId)
        return
      }

      const guestSession = verifyGuestSupportSession(data?.guestToken)
      if (guestSession && guestSession.roomId === roomId) {
        bindIdentity(socket, guestSession.roomId, guestSession.expiresAt.getTime())
        socket.join(roomId)
        return
      }

      socket.emit('support_auth_error', {
        code: 'invalid_guest_session',
        message: 'Недействительная guest-сессия поддержки'
      })
    })

    // Application chat rooms (1 application = 1 chat)
    on('application_chat_join', async (payload) => {
      try {
        const applicationId = parseOptionalPositiveInt(payload?.applicationId, { max: 2147483647 })
        const token = payload?.token
        if (!applicationId) return

        const user = await getUserFromToken(token, socket)
        if (!user) return
        if (!['admin', 'agent', 'individual'].includes(user.role)) return

        const appEntity = await Application.findByPk(applicationId)
        if (!appEntity) return
        if (!canAccessApplicationChat(appEntity, user)) return

        socket.join(`application:${applicationId}`)
        socket.emit('application_chat_joined', { applicationId })
      } catch (e) {
        logger.error('application_chat_join_failed', e)
      }
    })

    on('application_chat_leave', (payload) => {
      const applicationId = parseOptionalPositiveInt(payload?.applicationId, { max: 2147483647 })
      if (!applicationId) return
      socket.leave(`application:${applicationId}`)
    })
  })

  return io
}

module.exports = { createRealtimeServer }
