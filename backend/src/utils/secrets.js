const DEV_FALLBACK_SECRET = 'dev_jwt_secret'

function ensureSecret (name, value) {
  const isProd = process.env.NODE_ENV === 'production'
  const normalized = typeof value === 'string' ? value.trim() : ''

  if (normalized && normalized !== DEV_FALLBACK_SECRET) {
    return normalized
  }

  if (isProd) {
    throw new Error(`${name} must be set to a strong value in production`)
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
  return getJwtSecret()
}

module.exports = {
  getJwtSecret,
  getRefreshTokenSecret
}
