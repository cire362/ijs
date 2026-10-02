const request = require('supertest')
const bcrypt = require('bcryptjs')
const fs = require('fs/promises')
const path = require('path')
const app = require('../src/app')
const { sequelize } = require('../src/db')
const { User, Property, Application, ChatMessage, SupportChat, SupportRequest, AuthSession } = require('../src/models')
const { syncAndTruncateExcept } = require('./testDb')
const { saveSupportMessage, saveSupportReply } = require('../src/services/supportChatService')
const { issueGuestSupportSession } = require('../src/utils/guestSupportSession')
const { hashToken } = require('../src/utils/authTokens')

let admin, agent, developer
let adminToken, agentToken, otherToken, developerToken, agentCookies
let property, application
const createdFiles = []
const uploads = path.join(__dirname, '..', 'uploads')
const pdf = Buffer.from('%PDF-1.4\nprivate test document\n%%EOF')

function authorized (method, url, token = agentToken) {
  return request(app)[method](url).set('Authorization', `Bearer ${token}`)
}

beforeAll(async () => {
  await syncAndTruncateExcept(sequelize)
  const passwordHash = await bcrypt.hash('test_password', 10)
  const users = await User.bulkCreate(['admin', 'agent', 'agent', 'developer'].map((role, index) => ({
    role,
    email: `files-${index}@test.com`,
    passwordHash,
    firstName: 'Тест',
    lastName: 'Файлов',
    developerApproved: true
  })))
  ;[admin, agent, , developer] = users
  const tokens = []
  for (const user of users) {
    const res = await request(app).post('/auth/login').send({ email: user.email, password: 'test_password' })
    expect(res.status).toBe(200)
    tokens.push(res.body.token)
    if (user.id === agent.id) agentCookies = res.headers['set-cookie'].map((cookie) => cookie.split(';')[0])
  }
  ;[adminToken, agentToken, otherToken, developerToken] = tokens
})

beforeEach(async () => {
  property = await Property.create({ title: 'Дом', region: 'Область', city: 'Город', developerId: developer.id, price: 1000000 })
  application = await Application.create({ propertyId: property.id, agentId: agent.id, clientFullName: 'Клиент', clientPhone: '+7 999 111-22-33' })
})

afterAll(async () => {
  await Promise.all(createdFiles.map((file) => fs.unlink(file).catch(() => {})))
  await sequelize.close()
})

async function uploadDocument () {
  const res = await authorized('post', `/applications/${application.id}/chat/messages`)
    .attach('document', pdf, { filename: 'Договор.pdf', contentType: 'application/pdf' })
  expect(res.status).toBe(201)
  createdFiles.push(path.join(uploads, 'application_docs', path.basename(res.body.attachmentUrl)))
  return res.body.attachmentUrl
}

test('application documents require the owner or admin, including ordinary cookie-based browser links', async () => {
  const url = await uploadDocument()
  expect((await request(app).get(url)).status).toBe(401)
  expect((await authorized('get', url, otherToken)).status).toBe(403)
  expect((await authorized('get', url, developerToken)).status).toBe(403)
  const own = await request(app).get(url).set('Cookie', agentCookies)
  expect(own.status).toBe(200)
  expect(own.headers['cache-control']).toContain('no-store')
  expect(own.headers['content-disposition']).toContain('attachment;')
  expect((await authorized('get', url, adminToken)).status).toBe(200)
})

test('failed document uploads do not leave files on disk', async () => {
  const directory = path.join(uploads, 'application_docs')
  const before = await fs.readdir(directory)
  const res = await authorized('post', `/applications/${application.id}/chat/messages`, otherToken)
    .attach('document', pdf, { filename: 'forbidden.pdf', contentType: 'application/pdf' })
  expect(res.status).toBe(403)
  expect(await fs.readdir(directory)).toEqual(before)
})

test('an expired download cookie cannot open a private document', async () => {
  const url = await uploadDocument()
  const refreshToken = 'expired-document-session'
  await AuthSession.create({ userId: agent.id, refreshTokenHash: hashToken(refreshToken), expiresAt: new Date(Date.now() - 1000) })
  expect((await request(app).get(url).set('Cookie', `refresh_token=${refreshToken}`)).status).toBe(401)
  expect((await authorized('get', url)).status).toBe(200)
})

test('concurrent uploads with long Unicode names remain distinct and downloadable', async () => {
  const filename = `${'Договор'.repeat(40)}#%copy.pdf`
  const responses = await Promise.all([1, 2].map(() =>
    authorized('post', `/applications/${application.id}/chat/messages`)
      .attach('document', pdf, { filename, contentType: 'application/pdf' })
  ))
  expect(responses.map((res) => res.status)).toEqual([201, 201])
  expect(responses[0].body.attachmentUrl).not.toBe(responses[1].body.attachmentUrl)
  for (const res of responses) {
    const file = path.join(uploads, 'application_docs', path.basename(res.body.attachmentUrl))
    createdFiles.push(file)
    expect(Buffer.byteLength(path.basename(file), 'utf8')).toBeLessThanOrEqual(255)
    expect(res.body.attachmentOriginalName.length).toBeLessThanOrEqual(255)
    expect(res.body.attachmentUrl).not.toMatch(/[%#]/)
    expect((await authorized('get', res.body.attachmentUrl)).status).toBe(200)
  }
})

test('upload MIME mismatches and invalid fields return 400; oversized files return 413', async () => {
  const before = await fs.readdir(path.join(uploads, 'avatars'))
  const mismatch = await authorized('post', '/users/me/avatar')
    .attach('avatar', pdf, { filename: 'unsafe.exe', contentType: 'image/png' })
  expect(mismatch.status).toBe(400)
  const wrongField = await authorized('post', '/users/me/avatar')
    .attach('image', Buffer.from('png'), { filename: 'avatar.png', contentType: 'image/png' })
  expect(wrongField.status).toBe(400)
  const large = await authorized('post', '/users/me/avatar')
    .attach('avatar', Buffer.alloc(2 * 1024 * 1024 + 1), { filename: 'large.png', contentType: 'image/png' })
  expect(large.status).toBe(413)
  expect(await fs.readdir(path.join(uploads, 'avatars'))).toEqual(before)
})

test('properties with application history cannot be deleted or assigned to a different developer', async () => {
  expect((await authorized('delete', `/properties/${property.id}`, developerToken)).status).toBe(409)
  const second = await User.create({ role: 'developer', email: 'second-files-dev@test.com', passwordHash: developer.passwordHash, developerApproved: true })
  expect((await authorized('patch', `/properties/${property.id}`, adminToken).send({ developerId: second.id })).status).toBe(409)
  expect(await Application.findByPk(application.id)).not.toBeNull()
})

test('direct property edits cannot clear a reservation made through an application', async () => {
  expect((await authorized('patch', `/applications/${application.id}/status`, developerToken).send({ status: 'confirmed' })).status).toBe(200)
  expect((await authorized('patch', `/properties/${property.id}`, developerToken).send({ saleStatus: 'available' })).status).toBe(409)
  expect((await property.reload()).saleStatus).toBe('reserved')
})

test('rejecting a pending application does not clear a manually set reservation', async () => {
  await property.update({ saleStatus: 'reserved' })
  expect((await authorized('patch', `/applications/${application.id}/status`, developerToken).send({ status: 'rejected' })).status).toBe(200)
  expect((await property.reload()).saleStatus).toBe('reserved')
})

test('changing client data cannot turn another application into a duplicate', async () => {
  const second = await Application.create({ propertyId: property.id, agentId: agent.id, clientFullName: 'Второй', clientPhone: '+7 999 222-33-44' })
  const res = await authorized('patch', `/applications/${second.id}/client`).send({ clientFullName: 'Клиент', clientPhone: '89991112233' })
  expect(res.status).toBe(409)
  expect((await second.reload()).clientPhone).toBe('+7 999 222-33-44')
})

test('a zero-price filter is applied after query validation converts the value to a number', async () => {
  const free = await Property.create({ title: 'Бесплатный', region: 'Область', city: 'Город', developerId: developer.id, price: 0 })
  const res = await request(app).get('/properties?priceMax=0')
  expect(res.status).toBe(200)
  expect(res.body.map((item) => item.id)).toEqual([free.id])
})

test('support requests reject non-text and oversized messages before persistence', async () => {
  for (const message of [123, {}, ' ', 'x'.repeat(5001)]) {
    expect((await request(app).post('/support').send({ message })).status).toBe(400)
  }
  expect(await SupportRequest.count()).toBe(0)
  expect((await request(app).post('/support').send({ message: ' Помогите ', email: 'Person@Test.com', name: 'Гость' })).status).toBe(200)
  expect((await SupportRequest.findOne()).message).toBe('Помогите')
})

test('only admins can resolve chats, and a string false is not treated as true', async () => {
  const roomId = `user:${agent.id}`
  expect((await authorized('post', '/support/chats/resolve', otherToken).send({ roomId, resolved: true })).status).toBe(403)
  expect((await authorized('post', '/support/chats/resolve', adminToken).send({ roomId, resolved: 'false' })).status).toBe(400)
  expect((await authorized('post', '/support/chats/resolve', adminToken).send({ roomId, resolved: true })).body.isResolved).toBe(true)
  expect((await authorized('post', '/support/chats/resolve', adminToken).send({ roomId, resolved: false })).body.isResolved).toBe(false)
})

test('guest and user histories are isolated', async () => {
  const first = issueGuestSupportSession()
  const second = issueGuestSupportSession()
  await ChatMessage.create({ roomId: first.roomId, text: 'private' })
  expect((await request(app).get('/support/history').query({ roomId: first.roomId }).set('x-support-guest-token', second.guestToken)).status).toBe(403)
  expect((await request(app).get('/support/history').query({ roomId: first.roomId }).set('x-support-guest-token', first.guestToken)).body).toHaveLength(1)
  expect((await authorized('get', `/support/history?roomId=user:${agent.id}`, otherToken)).status).toBe(403)
})

test('support broadcasts use saved identity and do not include access or guest tokens', async () => {
  const roomId = `user:${agent.id}`
  await SupportChat.upsert({ roomId, isResolved: true, resolvedAt: new Date(), resolvedBy: admin.id })
  const payload = await saveSupportMessage(roomId, {
    text: ' Привет ', token: agentToken, guestToken: 'secret', senderName: 'Поддельный', senderEmail: 'fake@test.com'
  }, agent)
  expect(payload).toMatchObject({ text: 'Привет', senderName: agent.fullName, senderEmail: agent.email, movedToNew: true, isResolved: false })
  expect(payload.token).toBeUndefined()
  expect(payload.guestToken).toBeUndefined()
  expect((await SupportChat.findOne({ where: { roomId } })).isResolved).toBe(false)
})

test('invalid support replies cannot be persisted or sent to arbitrary socket rooms', async () => {
  const before = await ChatMessage.count()
  for (const payload of [{ roomId: 'admins', text: 'Hello' }, { roomId: `user:${agent.id}`, text: '' }, { roomId: `user:${agent.id}`, text: {} }]) {
    await expect(saveSupportReply(payload, admin)).rejects.toMatchObject({ status: 400 })
  }
  expect(await ChatMessage.count()).toBe(before)
})

test('malformed and oversized JSON requests return useful client errors', async () => {
  const malformed = await request(app).post('/support').set('Content-Type', 'application/json').send('{')
  expect(malformed.status).toBe(400)
  expect(malformed.headers['x-request-id']).toBeDefined()
  expect((await request(app).post('/support').send({ message: 'x'.repeat(1024 * 1024 + 1) })).status).toBe(413)
})

test('an untrusted cross-origin request is rejected as a client error', async () => {
  expect((await request(app).get('/health').set('Origin', 'https://untrusted.example')).status).toBe(403)
})
