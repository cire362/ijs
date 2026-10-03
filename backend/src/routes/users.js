const express = require('express')
const router = express.Router()
router.param('id', require('../middleware/idParam'))
const asyncHandler = require('../utils/asyncHandler')
const { authenticate, allowRoles } = require('../middleware/auth')
const validate = require('../middleware/validate')
const schemas = require('../validation/users')
const { uploadAvatar } = require('../utils/upload')
const {
  getMe,
  updateMe,
  deleteMe,
  uploadMyAvatar,
  changeMyPassword,
  setMyMarketingConsent,
  listDevelopers,
  approveDeveloper,
  rejectDeveloper,
  deleteDeveloperRequest,
  createDeveloperByAdmin
} = require('../controllers/userController')

router.get('/me', authenticate, asyncHandler(getMe))
router.patch('/me', authenticate, validate(schemas.updateMeSchema), asyncHandler(updateMe))
router.delete('/me', authenticate, validate(schemas.deleteMeSchema), asyncHandler(deleteMe))
router.patch('/me/password', authenticate, validate(schemas.changePasswordSchema), asyncHandler(changeMyPassword))
router.patch(
  '/me/consents/marketing',
  authenticate,
  validate(schemas.marketingConsentSchema),
  asyncHandler(setMyMarketingConsent)
)
router.post(
  '/me/avatar',
  authenticate,
  (req, res, next) =>
    uploadAvatar(req, res, (err) => (err ? next(err) : next())),
  asyncHandler(uploadMyAvatar)
)

router.get(
  '/developers',
  authenticate,
  allowRoles('admin'),
  validate(require('../validation/query').developersQuery, 'query'),
  asyncHandler(listDevelopers)
)

router.patch(
  '/developers/:id/approve',
  authenticate,
  allowRoles('admin'),
  asyncHandler(approveDeveloper)
)

router.patch(
  '/developers/:id/reject',
  authenticate,
  allowRoles('admin'),
  asyncHandler(rejectDeveloper)
)

router.delete(
  '/developers/:id',
  authenticate,
  allowRoles('admin'),
  asyncHandler(deleteDeveloperRequest)
)

router.post(
  '/developers',
  authenticate,
  allowRoles('admin'),
  validate(schemas.createDeveloperSchema),
  asyncHandler(createDeveloperByAdmin)
)

module.exports = router
