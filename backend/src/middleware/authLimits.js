const rateLimit = require('express-rate-limit')

const common = {
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Слишком много попыток, попробуйте позже' }
}

function loginEmail (req) {
  return String(req.body?.email || '').trim().toLowerCase().slice(0, 255)
}

module.exports = {
  loginLimit: rateLimit({ ...common, windowMs: 15 * 60 * 1000, max: 20, skipSuccessfulRequests: true }),
  // Limits password guessing for one account from many addresses.
  loginAccountLimit: rateLimit({
    ...common,
    windowMs: 15 * 60 * 1000,
    max: 10,
    skipSuccessfulRequests: true,
    keyGenerator: (req) => `login:${loginEmail(req)}`,
    skip: (req) => !loginEmail(req)
  }),
  registrationLimit: rateLimit({ ...common, windowMs: 15 * 60 * 1000, max: 20 }),
  refreshLimit: rateLimit({ ...common, windowMs: 60 * 1000, max: 120 }),
  passwordForgotLimit: rateLimit({ ...common, windowMs: 15 * 60 * 1000, max: 20 }),
  // Prevents flooding one mailbox with reset emails from many addresses.
  passwordForgotAccountLimit: rateLimit({
    ...common,
    windowMs: 60 * 60 * 1000,
    max: 3,
    keyGenerator: (req) => `forgot:${loginEmail(req)}`,
    skip: (req) => !loginEmail(req)
  }),
  passwordResetLimit: rateLimit({ ...common, windowMs: 15 * 60 * 1000, max: 10 }),
  logoutLimit: rateLimit({ ...common, windowMs: 60 * 1000, max: 30 }),
  supportLimit: rateLimit({
    ...common,
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { error: 'Слишком много обращений, попробуйте позже' }
  }),
  guestSessionLimit: rateLimit({ ...common, windowMs: 15 * 60 * 1000, max: 30 })
}
