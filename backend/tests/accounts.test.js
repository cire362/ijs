const request = require('supertest')
const bcrypt = require('bcryptjs')
const app = require('../src/app')
const { sequelize } = require('../src/db')
const { User, AuthSession } = require('../src/models')
const { syncAndTruncateExcept } = require('./testDb')
const { getSessionUser } = require('../src/utils/sessionUser')

let passwordHash; let counter = 0

function cookie (response, name) {
  return response.headers['set-cookie']?.find((value) => value.startsWith(`${name}=`))?.split(';')[0]
}
function csrf (response) {
  return cookie(response, 'csrf_token')?.split('=')[1]
}
async function user (extra = {}) {
  return User.create({ email: `session-${++counter}@test.com`, passwordHash, role: 'agent', ...extra })
}
async function login (account, client = request.agent(app)) {
  const res = await client.post('/auth/login').send({ email: account.email, password: 'test_password' })
  expect(res.status).toBe(200)
  return { client, res }
}
function me (token) {
  return request(app).get('/users/me').set('Authorization', `Bearer ${token}`)
}

beforeAll(async () => {
  await syncAndTruncateExcept(sequelize)
  passwordHash = await bcrypt.hash('test_password', 10)
})
afterAll(async () => sequelize.close())

test('logout immediately invalidates the access token as well as the refresh token', async () => {
  const account = await user()
  const { client, res } = await login(account)
  expect((await me(res.body.token)).status).toBe(200)
  expect((await client.post('/auth/logout').set('x-csrf-token', csrf(res))).status).toBe(200)
  expect((await me(res.body.token)).status).toBe(401)
  expect(await getSessionUser(res.body.token)).toBeNull()
})

test('logout-all invalidates access tokens on every device', async () => {
  const account = await user()
  const first = await login(account)
  const second = await login(account)
  expect((await first.client.post('/auth/logout-all').set('x-csrf-token', csrf(first.res))).status).toBe(200)
  expect((await me(first.res.body.token)).status).toBe(401)
  expect((await me(second.res.body.token)).status).toBe(401)
})

test('a password change closes other devices while preserving the current session', async () => {
  const account = await user()
  const current = await login(account)
  const other = await login(account)
  const changed = await current.client.patch('/users/me/password')
    .set('Authorization', `Bearer ${current.res.body.token}`)
    .send({ currentPassword: 'test_password', newPassword: 'new_test_password' })
  expect(changed.status).toBe(200)
  expect((await me(current.res.body.token)).status).toBe(200)
  expect((await me(other.res.body.token)).status).toBe(401)
  expect((await request(app).post('/auth/login').send({ email: account.email, password: 'test_password' })).status).toBe(401)
  expect((await request(app).post('/auth/login').send({ email: account.email, password: 'new_test_password' })).status).toBe(200)
})

test('an expired refresh session is removed, and its access token is unusable', async () => {
  const account = await user()
  const { client, res } = await login(account)
  await AuthSession.update({ expiresAt: new Date(Date.now() - 1000) }, { where: { userId: account.id } })
  expect((await me(res.body.token)).status).toBe(401)
  expect((await client.post('/auth/refresh').set('x-csrf-token', csrf(res))).status).toBe(401)
  expect(await AuthSession.count({ where: { userId: account.id } })).toBe(0)
})

test('concurrent refresh requests rotate a token once and preserve the active session', async () => {
  const account = await user()
  const { res } = await login(account)
  const cookies = [cookie(res, 'refresh_token'), cookie(res, 'csrf_token')]
  const responses = await Promise.all([1, 2].map(() =>
    request(app).post('/auth/refresh').set('Cookie', cookies).set('x-csrf-token', csrf(res))
  ))
  expect(responses.map((r) => r.status).sort()).toEqual([200, 401])
  const winner = responses.find((r) => r.status === 200)
  expect(responses.find((r) => r.status === 401).headers['set-cookie']).toBeUndefined()
  expect((await me(winner.body.token)).status).toBe(200)
  expect(await AuthSession.count({ where: { userId: account.id } })).toBe(1)
  const replay = await request(app).post('/auth/refresh').set('Cookie', cookies).set('x-csrf-token', csrf(res))
  expect(replay.status).toBe(401)
})

test('unapproved developers can view their profile but cannot create properties', async () => {
  const account = await user({ role: 'developer', developerApproved: false })
  const { res } = await login(account)
  expect((await me(res.body.token)).status).toBe(200)
  const created = await request(app).post('/properties').set('Authorization', `Bearer ${res.body.token}`)
    .send({ title: 'Дом', region: 'Область', city: 'Город' })
  expect(created.status).toBe(403)
})

test('rejected developers cannot sign in or continue using an old access token', async () => {
  const account = await user({ role: 'developer', developerApproved: false })
  const { res } = await login(account)
  await account.update({ developerRejected: true })
  expect((await me(res.body.token)).status).toBe(401)
  expect((await request(app).post('/auth/login').send({ email: account.email, password: 'test_password' })).status).toBe(403)
})

test('allowed cross-origin requests support the refresh-cookie session', async () => {
  const res = await request(app).options('/auth/login')
    .set('Origin', 'http://localhost:5173').set('Access-Control-Request-Method', 'POST')
  expect(res.status).toBe(204)
  expect(res.headers['access-control-allow-credentials']).toBe('true')
  expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173')
})

test('concurrent approval and deletion cannot remove an approved developer', async () => {
  const developer = await user({ role: 'developer', developerApproved: false })
  const administrator = await user({ role: 'admin' })
  const { res } = await login(administrator)
  const [approve, remove] = await Promise.all([
    request(app).patch(`/users/developers/${developer.id}/approve`).set('Authorization', `Bearer ${res.body.token}`),
    request(app).delete(`/users/developers/${developer.id}`).set('Authorization', `Bearer ${res.body.token}`)
  ])
  if (approve.status === 200) {
    expect(remove.status).toBe(400)
    expect((await User.findByPk(developer.id)).developerApproved).toBe(true)
  } else {
    expect(approve.status).toBe(404)
    expect(remove.status).toBe(200)
    expect(await User.findByPk(developer.id)).toBeNull()
  }
})
