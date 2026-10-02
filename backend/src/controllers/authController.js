const authService = require('../services/authService')
const passwordResetService = require('../services/passwordResetService')
const asyncHandler = require('../utils/asyncHandler')

const register = asyncHandler(async (req, res) => {
  const result = await authService.register(req.body)
  res.status(201).json(result)
})

const login = asyncHandler(async (req, res) => {
  const result = await authService.login(req.body.email, req.body.password, {
    req,
    res
  })
  res.json(result)
})

const refresh = asyncHandler(async (req, res) => {
  const result = await authService.refresh(req.cookies, { req, res })
  res.json(result)
})

const logout = asyncHandler(async (req, res) => {
  await authService.logout(req.cookies, { req, res })
  res.json({ success: true })
})

const logoutAll = asyncHandler(async (req, res) => {
  await authService.logoutAll(req.cookies, { req, res })
  res.json({ success: true })
})

const forgotPassword = asyncHandler(async (req, res) => {
  await passwordResetService.requestReset(req.body.email, { ip: req.ip })
  res.json({ success: true, message: 'Если аккаунт с таким email существует, мы отправили письмо со ссылкой для смены пароля' })
})

const resetPassword = asyncHandler(async (req, res) => {
  await passwordResetService.resetPassword(req.body.token, req.body.password)
  res.json({ success: true, message: 'Пароль изменён. Войдите с новым паролем' })
})

module.exports = {
  register,
  login,
  refresh,
  logout,
  logoutAll,
  forgotPassword,
  resetPassword
}
