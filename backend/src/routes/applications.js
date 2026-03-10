const express = require('express')
const router = express.Router()
const asyncHandler = require('../utils/asyncHandler')
const validate = require('../middleware/validate')
const {
  createApplicationSchema,
  updateClientInfoSchema,
  updateStatusSchema,
  extendDeadlineSchema
} = require('../validation/applications')
const { authenticate, allowRoles } = require('../middleware/auth')
const {
  listMine,
  listIncoming,
  createApplication,
  updateClientInfo,
  updateStatus,
  extendInitialDeadline
} = require('../controllers/applicationController')

const {
  listChats,
  listMessages,
  createMessage
} = require('../controllers/applicationChatController')

const { uploadApplicationDoc } = require('../utils/upload')

function maybeUploadApplicationDoc (req, res, next) {
  // Multer should run only for multipart requests.
  if (req.is && req.is('multipart/form-data')) {
    return uploadApplicationDoc(req, res, (err) => (err ? next(err) : next()))
  }
  return next()
}

router.get(
  '/mine',
  authenticate,
  allowRoles('agent', 'individual'),
  asyncHandler(listMine)
)
router.get(
  '/incoming',
  authenticate,
  allowRoles('developer', 'admin'),
  asyncHandler(listIncoming)
)

// Application chats list (1 application = 1 chat)
router.get(
  '/chat/chats',
  authenticate,
  allowRoles('agent', 'individual', 'admin'),
  asyncHandler(listChats)
)
router.post(
  '/',
  authenticate,
  allowRoles('agent', 'individual'),
  validate(createApplicationSchema),
  asyncHandler(createApplication)
)

router.patch(
  '/:id/client',
  authenticate,
  allowRoles('agent', 'individual'),
  validate(updateClientInfoSchema),
  asyncHandler(updateClientInfo)
)
router.patch(
  '/:id/status',
  authenticate,
  allowRoles('developer', 'admin'),
  validate(updateStatusSchema),
  asyncHandler(updateStatus)
)

router.patch(
  '/:id/extend',
  authenticate,
  allowRoles('developer', 'admin'),
  validate(extendDeadlineSchema),
  asyncHandler(extendInitialDeadline)
)

// Chat per application (1 application = 1 chat)
router.get(
  '/:id/chat/messages',
  authenticate,
  allowRoles('agent', 'individual', 'admin'),
  asyncHandler(listMessages)
)

router.post(
  '/:id/chat/messages',
  authenticate,
  allowRoles('agent', 'individual', 'admin'),
  maybeUploadApplicationDoc,
  asyncHandler(createMessage)
)

module.exports = router
