const express = require('express')
const router = express.Router()
const asyncHandler = require('../utils/asyncHandler')
const { requireCsrf } = require('../middleware/csrf')
const validate = require('../middleware/validate')
const { registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema } = require('../validation/auth')
const {
  loginLimit, loginAccountLimit, registrationLimit, refreshLimit, logoutLimit,
  passwordForgotLimit, passwordForgotAccountLimit, passwordResetLimit
} = require('../middleware/authLimits')
const {
  register,
  login,
  refresh,
  logout,
  logoutAll,
  forgotPassword,
  resetPassword
} = require('../controllers/authController')

router.post('/register', registrationLimit, validate(registerSchema), asyncHandler(register))
router.post('/login', loginLimit, loginAccountLimit, validate(loginSchema), asyncHandler(login))
router.post('/refresh', refreshLimit, requireCsrf, asyncHandler(refresh))
router.post('/logout', logoutLimit, requireCsrf, asyncHandler(logout))
router.post('/logout-all', logoutLimit, requireCsrf, asyncHandler(logoutAll))

router.post('/password/forgot', passwordForgotLimit, passwordForgotAccountLimit, validate(forgotPasswordSchema), asyncHandler(forgotPassword))
router.post('/password/reset', passwordResetLimit, validate(resetPasswordSchema), asyncHandler(resetPassword))

module.exports = router
