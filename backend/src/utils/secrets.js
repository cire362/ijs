const { strongSecret } = require('../config/environment')
const DEV_FALLBACK_SECRET = 'dev_jwt_secret'

function ensureSecret (name, value) {
  const isProd = process.env.NODE_ENV === 'production'
  const normalized = typeof value === 'string' ? value.trim() : ''

  if (isProd) return strongSecret(name, normalized)

  if (normalized && normalized !== DEV_FALLBACK_SECRET) {
    return normalized
  }

  return DEV_FALLBACK_SECRET
}

function getJwtSecret () {
  return ensureSecret('JWT_SECRET', process.env.JWT_SECRET)
}

function getRefreshTokenSecret () {
  const refresh = process.env.REFRESH_TOKEN_SECRET
  if (typeof refresh === 'string' && refresh.trim()) {
    return ensureSecret('REFRESH_TOKEN_SECRET', refresh)
  }
  if (process.env.NODE_ENV === 'production') return ensureSecret('REFRESH_TOKEN_SECRET', refresh)
  return getJwtSecret()
}

module.exports = {
  getJwtSecret,
  getRefreshTokenSecret
}
