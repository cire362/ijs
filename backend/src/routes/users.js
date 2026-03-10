const express = require('express')
const router = express.Router()
const asyncHandler = require('../utils/asyncHandler')
const { authenticate, allowRoles } = require('../middleware/auth')
const { uploadAvatar } = require('../utils/upload')
const {
  getMe,
  updateMe,
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
router.patch('/me', authenticate, asyncHandler(updateMe))
router.patch('/me/password', authenticate, asyncHandler(changeMyPassword))
router.patch(
  '/me/consents/marketing',
  authenticate,
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
  asyncHandler(createDeveloperByAdmin)
)

module.exports = router
