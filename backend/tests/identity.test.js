const request = require('supertest')
const bcrypt = require('bcryptjs')
const app = require('../src/app')
const { sequelize } = require('../src/db')
const { User } = require('../src/models')
const { syncAndTruncateExcept } = require('./testDb')

let adminToken, agentToken, agent
const registration = {
  role: 'agent',
  firstName: 'Иван',
  lastName: 'Иванов',
  companyName: 'Компания',
  password: 'test_password',
  consent: {
    legal: { accepted: true, documentVersion: 'test', termsPath: '/terms', privacyPath: '/privacy' },
    marketing: { accepted: false }
  }
}

beforeAll(async () => {
  await syncAndTruncateExcept(sequelize)
  const passwordHash = await bcrypt.hash('test_password', 10)
  const admin = await User.create({ email: 'identity-admin@test.com', role: 'admin', passwordHash })
  agent = await User.create({ email: 'identity-agent@test.com', role: 'agent', phone: '+7 999 100-00-01', passwordHash })
  adminToken = (await request(app).post('/auth/login').send({ email: admin.email, password: 'test_password' })).body.token
  agentToken = (await request(app).post('/auth/login').send({ email: agent.email, password: 'test_password' })).body.token
})
afterAll(async () => sequelize.close())

test('concurrent registration of differently formatted copies of one phone creates one account', async () => {
  const responses = await Promise.all([
    request(app).post('/auth/register').send({ ...registration, email: 'identity-first@test.com', phone: '+79992223344' }),
    request(app).post('/auth/register').send({ ...registration, email: 'identity-second@test.com', phone: '8 (999) 222-33-44' })
  ])
  expect(responses.map((r) => r.status).sort()).toEqual([201, 409])
  expect(await User.count({ where: { phone: '+7 999 222-33-44' } })).toBe(1)
})

test('admin creation and profile edits use the same phone uniqueness rule', async () => {
  const duplicate = await request(app).post('/users/developers').set('Authorization', `Bearer ${adminToken}`).send({
    email: 'duplicate-dev@test.com', phone: '89991000001', password: 'test_password', companyName: 'Застройщик'
  })
  expect(duplicate.status).toBe(409)
  const changed = await request(app).patch('/users/me').set('Authorization', `Bearer ${agentToken}`)
    .send({ phone: '8 (999) 222-33-44' })
  expect(changed.status).toBe(409)
  expect((await agent.reload()).phone).toBe('+7 999 100-00-01')
})

test('admin-created developer data is validated and normalized', async () => {
  const invalid = await request(app).post('/users/developers').set('Authorization', `Bearer ${adminToken}`)
    .send({ email: 'bad', phone: 'abc', password: 'x', companyName: '' })
  expect(invalid.status).toBe(400)
  const created = await request(app).post('/users/developers').set('Authorization', `Bearer ${adminToken}`).send({
    email: '  NEW-DEV@TEST.COM ', phone: '8 (999) 777-88-99', password: 'test_password', companyName: 'Застройщик'
  })
  expect(created.status).toBe(201)
  expect(created.body.email).toBe('new-dev@test.com')
  expect(created.body.phone).toBe('+7 999 777-88-99')
  expect(created.body.developerApproved).toBe(true)
  expect(created.body.passwordHash).toBeUndefined()
})

test('profile rejects invalid and blank data without modifying stored values', async () => {
  for (const payload of [{ email: '  ' }, { phone: 'abc' }, { firstName: 'x'.repeat(101) }]) {
    const res = await request(app).patch('/users/me').set('Authorization', `Bearer ${agentToken}`).send(payload)
    expect(res.status).toBe(400)
    expect(res.body.error).toBeTruthy()
  }
  expect((await agent.reload()).email).toBe('identity-agent@test.com')
})

test('registration normalizes email and rejects passwords silently truncated by bcrypt', async () => {
  const created = await request(app).post('/auth/register').send({
    ...registration, email: '  NORMALIZED@TEST.COM  ', phone: '+79991110000'
  })
  expect(created.status).toBe(201)
  expect(created.body.email).toBe('normalized@test.com')
  const tooLong = await request(app).post('/auth/register').send({
    ...registration, email: 'too-long@test.com', phone: '+79991110001', password: 'я'.repeat(37)
  })
  expect(tooLong.status).toBe(400)
})

test('public registration cannot create an administrator', async () => {
  const res = await request(app).post('/auth/register').send({
    ...registration, role: 'admin', email: 'fake-admin@test.com', phone: '+79991110002'
  })
  expect(res.status).toBe(400)
  expect(await User.count({ where: { email: 'fake-admin@test.com' } })).toBe(0)
})
