const notificationService = require('../services/notificationService')
const asyncHandler = require('../utils/asyncHandler')

const listNotifications = asyncHandler(async (req, res) => {
  const result = await notificationService.listNotifications(
    req.query,
    req.user
  )
  res.json(result)
})

const unreadCount = asyncHandler(async (req, res) => {
  const count = await notificationService.unreadCount(req.user)
  res.json({ count })
})

const markRead = asyncHandler(async (req, res) => {
  const note = await notificationService.markRead(req.params.id, req.user)
  res.json(note)
})

const markAllRead = asyncHandler(async (req, res) => {
  res.json({ count: await notificationService.markAllRead(req.user) })
})

module.exports = { listNotifications, markRead, markAllRead, unreadCount }
