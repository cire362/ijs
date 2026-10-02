const express = require('express')
const router = express.Router()
router.param('id', require('../middleware/idParam'))
const asyncHandler = require('../utils/asyncHandler')
const { authenticate } = require('../middleware/auth')
const {
  listNotifications,
  markRead,
  unreadCount
} = require('../controllers/notificationController')

router.get('/', authenticate, require('../middleware/validate')(require('../validation/query').notificationsQuery, 'query'), asyncHandler(listNotifications))
router.get('/unread-count', authenticate, asyncHandler(unreadCount))
router.post('/:id/read', authenticate, asyncHandler(markRead))

module.exports = router
