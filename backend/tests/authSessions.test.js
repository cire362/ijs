const request = require('supertest')
const bcrypt = require('bcryptjs')

const { syncAndTruncateExcept } = require('./testDb')

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

function extractCookie (setCookie, name) {
  const all = Array.isArray(setCookie) ? setCookie : []
  const found = all.find((c) => String(c).startsWith(`${name}=`))
  if (!found) return null
  return found.split(';')[0].slice(name.length + 1)
}

describe('auth sessions (refresh cookie)', () => {
  test('login sets refresh_token and csrf_token cookies', async () => {
    const { app, sequelize, email, password } = await buildIsolatedAppAndDb()
    try {
      const res = await request(app)
        .post('/auth/login')
        .send({ email, password })
      expect(res.status).toBe(200)
      expect(res.body.token).toBeDefined()

      const setCookie = res.headers['set-cookie']
      expect(extractCookie(setCookie, 'refresh_token')).toBeTruthy()
      expect(extractCookie(setCookie, 'csrf_token')).toBeTruthy()
    } finally {
      await sequelize.close()
    }
  })

  test('refresh requires CSRF header matching csrf cookie', async () => {
    const { app, sequelize, email, password } = await buildIsolatedAppAndDb()
    try {
      const agent = request.agent(app)
      const loginRes = await agent
        .post('/auth/login')
        .send({ email, password })
      expect(loginRes.status).toBe(200)

      const noCsrf = await agent.post('/auth/refresh')
      expect(noCsrf.status).toBe(403)

      const csrf = extractCookie(loginRes.headers['set-cookie'], 'csrf_token')
      const ok = await agent.post('/auth/refresh').set('x-csrf-token', csrf)

      expect(ok.status).toBe(200)
      expect(ok.body.token).toBeDefined()
    } finally {
      await sequelize.close()
    }
  })

  test('refresh rotates refresh_token cookie', async () => {
    const { app, sequelize, email, password } = await buildIsolatedAppAndDb()
    try {
      const agent = request.agent(app)
      const loginRes = await agent
        .post('/auth/login')
        .send({ email, password })

      const csrf1 = extractCookie(loginRes.headers['set-cookie'], 'csrf_token')
      const rt1 = extractCookie(
        loginRes.headers['set-cookie'],
        'refresh_token'
      )
      expect(rt1).toBeTruthy()

      const refreshRes = await agent
        .post('/auth/refresh')
        .set('x-csrf-token', csrf1)

      expect(refreshRes.status).toBe(200)
      const rt2 = extractCookie(
        refreshRes.headers['set-cookie'],
        'refresh_token'
      )
      expect(rt2).toBeTruthy()
      expect(rt2).not.toEqual(rt1)
    } finally {
      await sequelize.close()
    }
  })

  test('logout-all revokes sessions on other devices', async () => {
    const { app, sequelize, email, password } = await buildIsolatedAppAndDb()
    try {
      const agent1 = request.agent(app)
      const agent2 = request.agent(app)

      const login1 = await agent1.post('/auth/login').send({ email, password })
      expect(login1.status).toBe(200)
      const csrf1 = extractCookie(login1.headers['set-cookie'], 'csrf_token')

      const login2 = await agent2.post('/auth/login').send({ email, password })
      expect(login2.status).toBe(200)
      const csrf2 = extractCookie(login2.headers['set-cookie'], 'csrf_token')

      const logoutAll = await agent1
        .post('/auth/logout-all')
        .set('x-csrf-token', csrf1)
      expect(logoutAll.status).toBe(200)

      const refresh2 = await agent2
        .post('/auth/refresh')
        .set('x-csrf-token', csrf2)
      expect(refresh2.status).toBe(401)
    } finally {
      await sequelize.close()
    }
  })
})
