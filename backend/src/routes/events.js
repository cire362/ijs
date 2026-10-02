const express = require('express')
const router = express.Router()
router.param('id', require('../middleware/idParam'))
const asyncHandler = require('../utils/asyncHandler')
const validate = require('../middleware/validate')
const {
  createEventSchema,
  updateEventSchema,
  cancelEventSchema,
  updateRegistrationStatusSchema
} = require('../validation/events')
const {
  authenticate,
  optionalAuthenticate,
  allowRoles
} = require('../middleware/auth')
const {
  listEvents,
  createEvent,
  updateEvent,
  cancelEvent,
  cancelMyRegistration,
  uploadEventCover,
  registerForEvent,
  listRegistrations,
  listMyRegistrations,
  updateRegistrationStatus
} = require('../controllers/eventsController')

const { uploadEventCoverImage } = require('../utils/upload')

router.get('/', optionalAuthenticate, validate(require('../validation/query').eventsQuery, 'query'), asyncHandler(listEvents))

router.post(
  '/',
  authenticate,
  allowRoles('admin'),
  validate(createEventSchema),
  asyncHandler(createEvent)
)

router.post(
  '/:id/image',
  authenticate,
  allowRoles('admin'),
  (req, res, next) =>
    uploadEventCoverImage(req, res, (err) => (err ? next(err) : next())),
  asyncHandler(uploadEventCover)
)

router.patch(
  '/:id',
  authenticate,
  allowRoles('admin'),
  validate(updateEventSchema),
  asyncHandler(updateEvent)
)

router.post(
  '/:id/cancel',
  authenticate,
  allowRoles('admin'),
  validate(cancelEventSchema),
  asyncHandler(cancelEvent)
)

router.delete(
  '/:id/register',
  authenticate,
  allowRoles('agent', 'individual'),
  asyncHandler(cancelMyRegistration)
)

router.post(
  '/:id/register',
  authenticate,
  allowRoles('agent', 'individual'),
  asyncHandler(registerForEvent)
)

router.get(
  '/registrations',
  authenticate,
  allowRoles('admin'),
  validate(require('../validation/query').registrationsQuery, 'query'),
  asyncHandler(listRegistrations)
)

router.patch(
  '/registrations/:id',
  authenticate,
  allowRoles('admin'),
  validate(updateRegistrationStatusSchema),
  asyncHandler(updateRegistrationStatus)
)

router.get(
  '/my',
  authenticate,
  allowRoles('agent', 'individual'),
  validate(require('../validation/query').paginationQuery, 'query'),
  asyncHandler(listMyRegistrations)
)

module.exports = router
