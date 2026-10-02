const request = require('supertest')
const bcrypt = require('bcryptjs')

const {
  parseIntStrict,
  normalizeSpace,
  stripControlChars,
  toSafeText
} = require('../src/utils/validation')
const { syncAndTruncateExcept } = require('./testDb')
const { requestPath } = require('../src/utils/requestPath')

async function buildIsolatedAppAndDb () {
  jest.resetModules()

  const app = require('../src/app')
  const { sequelize } = require('../src/db')
  const { User } = require('../src/models')

  await syncAndTruncateExcept(sequelize, {
    keepTables: ['address_suggestions']
  })

  const password = 'password'
  const passwordHash = await bcrypt.hash(password, 10)
  await User.create({
    email: 'agent@test.com',
    passwordHash,
    role: 'agent',
    firstName: 'Агент',
    lastName: 'Тест'
  })

  return { app, sequelize, email: 'agent@test.com', password }
}

describe('validation utils', () => {
  test('parseIntStrict accepts digits only', () => {
    expect(parseIntStrict('123')).toBe(123)
    expect(parseIntStrict('  001  ')).toBe(1)
    expect(parseIntStrict('-1')).toBeNull()
    expect(parseIntStrict('1.5')).toBeNull()
    expect(parseIntStrict('1 OR 1=1')).toBeNull()
    expect(parseIntStrict('abc')).toBeNull()
  })

  test('normalizeSpace collapses whitespace and trims', () => {
    expect(normalizeSpace('  a   b\n\t c  ')).toBe('a b c')
  })

  test('toSafeText strips control chars and truncates', () => {
    const raw = 'a\u0000b\u0007c'
    expect(stripControlChars(raw)).toBe('abc')

    const long = 'x'.repeat(10)
    expect(toSafeText(long, { maxLen: 5 })).toBe('xxxxx')
  })

  test('request logs redact access, refresh and guest tokens while keeping useful filters', () => {
    const logged = requestPath('/support/history?roomId=user%3A1&guestToken=secret&token=jwt&refresh_token=refresh')
    expect(logged).toContain('roomId=user%3A1')
    expect(logged).not.toContain('secret')
    expect(logged).not.toContain('jwt')
    expect(new URL(logged, 'http://internal').searchParams.get('refresh_token')).toBe('[redacted]')
  })
})

describe('rate limiting', () => {
  test('/health is skipped (no rate limit headers)', async () => {
    const { app, sequelize } = await buildIsolatedAppAndDb()
    try {
      const res = await request(app).get('/health')
      expect(res.status).toBe(200)
      expect(res.headers['ratelimit-limit']).toBeUndefined()
    } finally {
      await sequelize.close()
    }
  })

  test('/auth/login has stricter limit headers', async () => {
    const { app, sequelize } = await buildIsolatedAppAndDb()
    try {
      const res = await request(app)
        .post('/auth/login')
        .send({ email: 'agent@test.com', password: 'password' })

      // The per-account login limit is the strictest one and sets the headers.
      expect(res.headers['ratelimit-limit']).toBe('10')
      expect([200, 401]).toContain(res.status)
    } finally {
      await sequelize.close()
    }
  })

  test('/auth/login returns 429 after too many attempts for one account', async () => {
    const { app, sequelize, email, password } = await buildIsolatedAppAndDb()
    try {
      for (let i = 0; i < 10; i++) {
        const res = await request(app)
          .post('/auth/login')
          .send({ email, password: `${password}_wrong` })
        expect([200, 401]).toContain(res.status)
      }

      const last = await request(app)
        .post('/auth/login')
        .send({ email, password: `${password}_wrong` })
      expect(last.status).toBe(429)
      expect(last.body?.error).toBeDefined()
    } finally {
      await sequelize.close()
    }
  })
})
