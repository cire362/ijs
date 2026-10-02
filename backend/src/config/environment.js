const proxyaddr = require('proxy-addr')

const weakValue = /replace|change.?me|example|placeholder|generated|your[_-]|set[_-]|dev_jwt_secret|supersecret|test.?secret/i
function strongSecret (name, value) {
  if (typeof value !== 'string' || value !== value.trim() || Buffer.byteLength(value) < 32 || weakValue.test(value) || new Set(value).size < 12) {
    throw new Error(`${name} must contain a generated secret of at least 32 bytes; example values are forbidden`)
  }
  return value.trim()
}

function intSetting (env, name, fallback, min, max) {
  if (env[name] == null || env[name] === '') return fallback
  if (!/^\d+$/.test(env[name]) || Number(env[name]) < min || Number(env[name]) > max) throw new Error(`${name} is outside its allowed range`)
  return Number(env[name])
}

function trustedProxies (env = process.env) {
  const addresses = String(env.TRUST_PROXY || '').split(',').map(value => value.trim()).filter(Boolean)
  if (addresses.some(value => ['true', 'false', '0', '1'].includes(value) || /\/(0|[1-7])$/.test(value) || (value.includes(':') && /\/(\d|[12]\d|3[01])$/.test(value)))) {
    throw new Error('TRUST_PROXY must list specific trusted proxy IP addresses or networks')
  }
  try { return addresses.length ? proxyaddr.compile(addresses) : () => false } catch {
    throw new Error('TRUST_PROXY contains an invalid IP address or network')
  }
}

function databaseUrl (env = process.env) {
  const url = env.NODE_ENV === 'test' ? env.TEST_DATABASE_URL || env.DATABASE_URL : env.DATABASE_URL
  if (!url && env.NODE_ENV === 'production') throw new Error('DATABASE_URL is required in production')
  return url || 'postgres://postgres:123@localhost:5432/ijshub'
}

function validateEnvironment (env = process.env) {
  const production = env.NODE_ENV === 'production'
  const port = intSetting(env, 'PORT', 4000, 1, 65535)
  const poolMax = intSetting(env, 'DB_POOL_MAX', 20, 3, 100)
  const acquireMs = intSetting(env, 'DB_ACQUIRE_TIMEOUT_MS', 5000, 1000, 30000)
  const queryMs = intSetting(env, 'DB_QUERY_TIMEOUT_MS', 15000, 1000, 120000)
  const shutdownMs = intSetting(env, 'SHUTDOWN_TIMEOUT_MS', 25000, 1000, 120000)
  trustedProxies(env)
  try { Intl.DateTimeFormat('ru', { timeZone: env.EVENT_TIME_ZONE || 'Europe/Moscow' }).resolvedOptions() } catch { throw new Error('EVENT_TIME_ZONE is invalid') }
  if (env.ACCESS_TOKEN_TTL && !/^[1-9]\d*(s|m|h)$/.test(env.ACCESS_TOKEN_TTL)) throw new Error('ACCESS_TOKEN_TTL must be a positive duration in seconds, minutes or hours')
  intSetting(env, 'REFRESH_TOKEN_DAYS', 30, 1, 365)
  for (const name of ['COOKIE_SECURE', 'RUN_SCHEDULED_JOBS', 'CORS_ALLOW_CREDENTIALS']) {
    if (env[name] != null && !['true', 'false', '1', '0'].includes(env[name])) throw new Error(`${name} must be true or false`)
  }
  if (env.COOKIE_SAME_SITE && !['lax', 'strict', 'none'].includes(env.COOKIE_SAME_SITE)) throw new Error('COOKIE_SAME_SITE is invalid')
  if (env.SMTP_URL) {
    let smtp
    try { smtp = new URL(env.SMTP_URL) } catch { throw new Error('SMTP_URL is invalid') }
    if (!['smtp:', 'smtps:'].includes(smtp.protocol) || !smtp.hostname) throw new Error('SMTP_URL must be an smtp:// or smtps:// URL')
    if (production && smtp.protocol === 'smtp:' && !/[?&]requireTLS=true/.test(smtp.search)) {
      throw new Error('Production SMTP must use smtps:// or smtp:// with ?requireTLS=true')
    }
    if (!env.MAIL_FROM || !/^[^<>]*<?[^@\s<>]+@[^@\s<>]+>?$/.test(env.MAIL_FROM)) throw new Error('MAIL_FROM is required with SMTP_URL, e.g. "ИЖС Hub <no-reply@example.ru>"')
  }
  if (production) {
    strongSecret('JWT_SECRET', env.JWT_SECRET)
    strongSecret('REFRESH_TOKEN_SECRET', env.REFRESH_TOKEN_SECRET)
    strongSecret('OPS_TOKEN', env.OPS_TOKEN)
    if (new Set([env.JWT_SECRET, env.REFRESH_TOKEN_SECRET, env.OPS_TOKEN]).size !== 3) throw new Error('JWT_SECRET, REFRESH_TOKEN_SECRET and OPS_TOKEN must differ')
    let db
    try { db = new URL(databaseUrl(env)) } catch { throw new Error('DATABASE_URL is invalid') }
    let password
    try { password = decodeURIComponent(db.password) } catch { throw new Error('DATABASE_URL has invalid credential encoding') }
    if (!['postgres:', 'postgresql:'].includes(db.protocol) || !db.hostname || db.pathname.length < 2 || password.length < 16 || weakValue.test(password) || /^(postgres|password)/i.test(password)) {
      throw new Error('DATABASE_URL must identify PostgreSQL with a non-default password of at least 16 characters')
    }
    const origins = [...String(env.CORS_ALLOWED_ORIGINS || '').split(','), env.APP_ORIGIN].filter(Boolean)
    if (!origins.length) throw new Error('At least one HTTPS application origin is required')
    for (const origin of origins) {
      let parsed
      try { parsed = new URL(origin.trim()) } catch { throw new Error('Application origins must be HTTPS URLs') }
      if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== '/' || /^(localhost|127\.|0\.0\.0\.0|example\.)/i.test(parsed.hostname)) throw new Error('Application origins must be real HTTPS origins without paths or credentials')
    }
    if (!env.TRUST_PROXY) throw new Error('TRUST_PROXY is required for the production proxy topology')
    if (['false', '0'].includes(env.COOKIE_SECURE)) throw new Error('Secure cookies cannot be disabled in production')
    if (['false', '0'].includes(env.RUN_SCHEDULED_JOBS)) throw new Error('Scheduled jobs must be enabled for this production deployment')
    if (env.WEB_CONCURRENCY && env.WEB_CONCURRENCY !== '1') throw new Error('This deployment supports one API process; multiple processes require shared Socket.IO and rate-limit stores')
  }
  return { port, poolMax, acquireMs, queryMs, shutdownMs }
}

module.exports = { validateEnvironment, strongSecret, trustedProxies, databaseUrl, intSetting }
