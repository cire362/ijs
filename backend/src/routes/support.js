const { listSupportChats, listSupportMessages } = require('../services/supportChatService')
const express = require('express')
const router = express.Router()
const asyncHandler = require('../utils/asyncHandler')
const { SupportRequest, ChatMessage, SupportChat } = require('../models')
const { optionalAuthenticate, authenticate } = require('../middleware/auth')
const validate = require('../middleware/validate')
const { supportLimit, guestSessionLimit } = require('../middleware/authLimits')
const { supportRequestSchema, supportHistorySchema, supportRoomSchema, supportResolveSchema } = require('../validation/support')
const {
  issueGuestSupportSession,
  verifyGuestSupportSession
} = require('../utils/guestSupportSession')

function readGuestSupportSession (req) {
  const headerToken = req.headers['x-support-guest-token']
  const bodyToken = req.body?.guestToken
  const queryToken = req.query?.guestToken
  const guestToken = headerToken || bodyToken || queryToken
  return verifyGuestSupportSession(guestToken)
}

router.post(
  '/guest-session',
  guestSessionLimit,
  optionalAuthenticate,
  asyncHandler(async (req, res) => {
    if (req.user) {
      return res.json({ roomId: `user:${req.user.id}`, guestToken: null })
    }

    const requestedRoomId = req.body?.roomId
    const existingSession = readGuestSupportSession(req)

    if (
      existingSession &&
      (!requestedRoomId || requestedRoomId === existingSession.roomId)
    ) {
      return res.json(existingSession)
    }

    return res.status(201).json(issueGuestSupportSession())
  })
)

// GET /api/support/chats - Get list of unique chats (Admin only)
router.get(
  '/chats',
  authenticate,
  validate(require('../validation/query').chatListQuery, 'query'),
  asyncHandler(async (req, res) => {
    if (req.user.role !== 'admin') return res.sendStatus(403)

    const chats = await listSupportChats(req.query)

    res.json(chats)
  })
)

// POST /api/support/chats/resolve - Mark chat resolved/unresolved (Admin only)
router.post(
  '/chats/resolve',
  authenticate,
  validate(supportResolveSchema),
  asyncHandler(async (req, res) => {
    if (req.user.role !== 'admin') return res.sendStatus(403)

    const { roomId, resolved } = req.body || {}
    if (!roomId) return res.status(400).json({ error: 'No roomId' })

    const wantResolved = Boolean(resolved)

    await SupportChat.upsert({
      roomId,
      isResolved: wantResolved,
      resolvedAt: wantResolved ? new Date() : null,
      resolvedBy: wantResolved ? req.user.id : null
    })

    res.json({ ok: true, roomId, isResolved: wantResolved })
  })
)

// GET /api/support/history?roomId=...
router.get(
  '/history',
  optionalAuthenticate,
  validate(supportHistorySchema, 'query'),
  asyncHandler(async (req, res) => {
    const { roomId } = req.query
    if (!roomId) return res.status(400).json({ error: 'No roomId' })

    if (!req.user) {
      const guestSession = readGuestSupportSession(req)
      if (!guestSession || guestSession.roomId !== roomId) {
        return res.status(403).json({ error: 'Недействительная guest-сессия' })
      }
    } else if (req.user.role !== 'admin') {
      const expectedRoomId = `user:${req.user.id}`
      if (roomId !== expectedRoomId) {
        return res.sendStatus(403)
      }
    }

    const messages = await listSupportMessages(roomId, req.query)
    res.json(messages)
  })
)

router.post(
  '/',
  supportLimit,
  optionalAuthenticate,
  validate(supportRequestSchema),
  asyncHandler(async (req, res) => {
    const { message, email, name } = req.body

    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Сообщение не может быть пустым' })
    }

    const ip = req.ip || req.connection.remoteAddress

    // Use logged-in user data if available
    let senderName = name
    let senderEmail = email

    if (req.user) {
      senderName = senderName || req.user.fullName
      senderEmail = senderEmail || req.user.email
    }

    await SupportRequest.create({
      name: senderName || 'Гость',
      email: senderEmail,
      message,
      ip
    })

    res.json({ success: true, message: 'Сообщение отправлено' })
  })
)

// POST /api/support/read - Mark messages as read (Admin only)
router.post(
  '/read',
  authenticate,
  validate(supportRoomSchema),
  asyncHandler(async (req, res) => {
    if (req.user.role !== 'admin') return res.sendStatus(403)

    const { roomId } = req.body
    if (!roomId) return res.status(400).json({ error: 'No roomId' })

    await ChatMessage.update(
      { isRead: true },
      {
        where: {
          roomId,
          isAdmin: false,
          isRead: false
        }
      }
    )

    res.json({ ok: true })
  })
)

module.exports = router
