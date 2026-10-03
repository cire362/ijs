const fs = require('fs/promises')
const path = require('path')
const crypto = require('crypto')
const { domainToASCII } = require('url')
const { validateEnvironment } = require('../src/config/environment')

async function createProductionEnv ({ domain, mirrorPath, destination = path.resolve(__dirname, '../../.env.production') }) {
  domain = domainToASCII(String(domain || '').trim())
  if (!/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/i.test(domain) || /example\.|localhost/i.test(domain)) throw new Error('Provide a real DNS domain without a scheme or port')
  if (!mirrorPath || !path.isAbsolute(mirrorPath) || /[\r\n:]/.test(mirrorPath)) throw new Error('Provide an absolute independent backup destination path')
  const secret = () => crypto.randomBytes(32).toString('hex')
  const env = {
    DOMAIN: domain,
    APP_ORIGIN: `https://${domain}`,
    CORS_ALLOWED_ORIGINS: `https://${domain}`,
    JWT_SECRET: secret(),
    REFRESH_TOKEN_SECRET: secret(),
    OPS_TOKEN: secret(),
    BACKUP_ENCRYPTION_KEY: secret(),
    POSTGRES_PASSWORD: secret(),
    APP_DB_USER: 'ijs_app',
    APP_DB_PASSWORD: secret(),
    POSTGRES_DB: 'ijshub',
    BACKEND_SUBNET: '172.30.50.0/24',
    COOKIE_SECURE: 'true',
    EVENT_TIME_ZONE: 'Europe/Moscow',
    BACKUP_MIRROR_PATH: mirrorPath,
    BACKUP_KEEP: '14',
    BACKUP_INTERVAL_SECONDS: '86400',
    MONITOR_WEBHOOK_URL: '',
    // Password reset emails: fill in a mailbox of your provider, e.g. smtps://user:password@smtp.yandex.ru:465.
    SMTP_URL: '',
    MAIL_FROM: `ИЖС платформа <no-reply@${domain}>`,
    // Address suggestions and map coordinates: the API key from the dadata.ru profile.
    DADATA_API_KEY: ''
  }
  env.DATABASE_URL = `postgres://ijs_app:${env.APP_DB_PASSWORD}@db:5432/ijshub`
  validateEnvironment({ ...env, NODE_ENV: 'production', TRUST_PROXY: env.BACKEND_SUBNET })
  await fs.writeFile(destination, Object.entries(env).map(([key, value]) => `${key}=${JSON.stringify(value)}`).join('\n') + '\n', { mode: 0o600, flag: 'wx' })
  return destination
}

if (require.main === module) {
  createProductionEnv({ domain: process.argv[2], mirrorPath: process.argv[3], destination: process.argv[4] })
    .then(file => console.log(`Production environment created: ${file}. Existing files are never overwritten.`))
    .catch(error => { console.error(error.message); process.exitCode = 1 })
}
module.exports = { createProductionEnv }
