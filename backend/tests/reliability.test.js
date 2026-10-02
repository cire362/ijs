const request = require('supertest')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const fs = require('fs/promises')
const path = require('path')
const app = require('../src/app')
const { sequelize } = require('../src/db')
const {
  User, AuthSession, Property, PropertyImage, Application, ApplicationChatMessage, ChatMessage,
  Event, EventRegistration, EventReminder, Notification, FileDeletion, AuditLog
} = require('../src/models')
const { syncAndTruncateExcept } = require('./testDb')
const { hashToken } = require('../src/utils/authTokens')
const { queueFileDeletion, cleanupFiles, localFilePath } = require('../src/jobs/fileCleanup')
const { sendEventReminders } = require('../src/jobs/eventReminders')
const eventsService = require('../src/services/eventsService')
const tariffsService = require('../src/services/tariffsService')
const applicationService = require('../src/services/applicationService')
const { saveSupportMessage, saveSupportReply } = require('../src/services/supportChatService')
const { commissionSnapshot } = require('../src/utils/commission')
const { assertResetAllowed } = require('../src/db/reset')

let admin, agent, other, developer, property
const tokens = new Map()
const files = new Set()
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jGqQAAAAASUVORK5CYII=', 'base64')
const pdf = Buffer.from('%PDF-1.4\ntest\n%%EOF')
function call (method, url, user = admin) { return request(app)[method](url).set('Authorization', `Bearer ${tokens.get(user.id)}`) }
function track (url) { const file = localFilePath(url); if (file) files.add(file); return file }
// Each author has a distinct client: an active application fixes the client on the object.
async function application (user = agent) { return applicationService.createApplication({ propertyId: property.id, clientFullName: 'Клиент', clientPhone: `+7 999 222-${String(user.id).padStart(2, '0').slice(-2)}-44` }, user) }
async function event (offsetMinutes = 30) { return Event.create({ title: 'Событие', startAt: new Date(Date.now() + offsetMinutes * 60000), createdBy: admin.id }) }
async function login () {
  const res = await request(app).post('/auth/login').send({ email: agent.email, password: 'test_password' })
  expect(res.status).toBe(200)
  const cookies = res.headers['set-cookie'].map((cookie) => cookie.split(';')[0])
  return { cookies, csrf: cookies.find((cookie) => cookie.startsWith('csrf_token=')).split('=')[1] }
}
function withCookies (route, session) { return request(app).post(route).set('Cookie', session.cookies).set('x-csrf-token', session.csrf) }

beforeAll(async () => {
  await syncAndTruncateExcept(sequelize)
  const passwordHash = await bcrypt.hash('test_password', 4)
  ;[admin, agent, other, developer] = await User.bulkCreate(['admin', 'agent', 'agent', 'developer'].map((role, i) => ({
    role, email: `reliability-${i}@test.com`, passwordHash, developerApproved: true
  })))
  for (const user of [admin, agent, other, developer]) {
    const session = await AuthSession.create({ userId: user.id, refreshTokenHash: hashToken(`fixture-${user.id}`), expiresAt: new Date(Date.now() + 3600000) })
    tokens.set(user.id, jwt.sign({ sub: user.id, sid: session.id }, process.env.JWT_SECRET, { expiresIn: '1h' }))
  }
})
beforeEach(async () => {
  await sequelize.query('TRUNCATE properties, applications, events, notifications, chat_messages, support_chats, audit_logs, file_deletions RESTART IDENTITY CASCADE')
  property = await Property.create({ title: 'Дом', region: 'Область', city: 'Город', developerId: developer.id, price: '1000000.00' })
})
afterEach(() => jest.restoreAllMocks())
afterAll(async () => {
  await Promise.all([...files].map((file) => fs.unlink(file).catch(() => {})))
  await sequelize.close()
})

test.each([
  ['image.png', 'image/png'], ['image.jpg', 'image/jpeg'], ['image.webp', 'image/webp']
])('rejects disguised image content: %s', async (filename, contentType) => {
  const before = await fs.readdir(path.join(__dirname, '../uploads/avatars'))
  const res = await call('post', '/users/me/avatar', agent).attach('avatar', Buffer.from('<script>bad</script>'), { filename, contentType })
  expect(res.status).toBe(400)
  expect(await fs.readdir(path.join(__dirname, '../uploads/avatars'))).toEqual(before)
})
test.each([
  ['fake.pdf', 'application/pdf'], ['fake.doc', 'application/msword'],
  ['fake.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  ['fake.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'], ['fake.txt', 'text/plain']
])('rejects disguised document content: %s', async (filename, contentType) => {
  const res = await call('post', `/properties/${property.id}/documents`).attach('document', Buffer.from([0, 1, 2, 3]), { filename, contentType })
  expect(res.status).toBe(400)
  expect((await call('get', `/properties/${property.id}`)).body.documents).toHaveLength(0)
})
test('replacing an avatar removes the previous file after commit', async () => {
  const first = await call('post', '/users/me/avatar', agent).attach('avatar', png, 'first.png')
  expect(first.status).toBe(200)
  track(first.body.avatarUrl)
  const second = await call('post', '/users/me/avatar', agent).attach('avatar', png, 'second.png')
  expect(second.status).toBe(200)
  track(second.body.avatarUrl)
  await expect(fs.stat(localFilePath(first.body.avatarUrl))).rejects.toMatchObject({ code: 'ENOENT' })
  expect((await request(app).get(first.body.avatarUrl)).status).toBe(404)
  expect((await request(app).get(second.body.avatarUrl)).status).toBe(200)
})
test('failed avatar replacement preserves the old file and cleans the new upload', async () => {
  const first = await call('post', '/users/me/avatar', agent).attach('avatar', png, 'first.png')
  track(first.body.avatarUrl)
  const before = await fs.readdir(path.join(__dirname, '../uploads/avatars'))
  jest.spyOn(User.prototype, 'update').mockRejectedValueOnce(new Error('temporary database failure'))
  expect((await call('post', '/users/me/avatar', agent).attach('avatar', png, 'second.png')).status).toBe(500)
  expect(await fs.readdir(path.join(__dirname, '../uploads/avatars'))).toEqual(before)
  expect(await FileDeletion.count()).toBe(0)
  expect((await User.findByPk(agent.id)).avatarUrl).toBe(first.body.avatarUrl)
})
test('document deletion immediately revokes the URL and retries disk failures', async () => {
  const upload = await call('post', `/properties/${property.id}/documents`).attach('document', pdf, { filename: 'document.pdf', contentType: 'application/pdf' })
  expect(upload.status).toBe(201)
  const doc = upload.body.documents[0]
  track(doc.url)
  expect((await request(app).get(doc.url)).status).toBe(200)
  jest.spyOn(fs, 'unlink').mockRejectedValueOnce(Object.assign(new Error('busy disk'), { code: 'EACCES' }))
  expect((await call('delete', `/properties/documents/${doc.id}`)).status).toBe(200)
  expect((await request(app).get(doc.url)).status).toBe(404)
  const queued = await FileDeletion.findOne()
  expect(queued.attempts).toBe(1)
  expect(queued.lastError).toBe('EACCES')
  expect((await cleanupFiles({ now: new Date(Date.now() + 60000) })).deleted).toBe(1)
  await expect(fs.stat(localFilePath(doc.url))).rejects.toMatchObject({ code: 'ENOENT' })
})
test('deleting a property removes its image files', async () => {
  const upload = await call('post', `/properties/${property.id}/images`).attach('images', png, 'house.png')
  expect(upload.status).toBe(201)
  const file = track(upload.body.images[0].url)
  expect((await call('delete', `/properties/${property.id}`)).status).toBe(200)
  await expect(fs.stat(file)).rejects.toMatchObject({ code: 'ENOENT' })
  expect(await PropertyImage.count()).toBe(0)
})
test('a rolled-back deletion never removes the file', async () => {
  const url = '/uploads/properties/reliability-rollback.png'
  const file = track(url)
  await fs.writeFile(file, png)
  await expect(sequelize.transaction(async (transaction) => {
    await queueFileDeletion([url], transaction)
    throw new Error('rollback')
  })).rejects.toThrow('rollback')
  expect(await FileDeletion.count()).toBe(0)
  expect((await fs.stat(file)).size).toBe(png.length)
})
test('a backup defers file deletion without blocking the committed API operation', async () => {
  const { Client } = require('pg')
  const backup = new Client({ connectionString: process.env.TEST_DATABASE_URL })
  const url = '/uploads/properties/reliability-backup.png'
  const file = track(url)
  await fs.writeFile(file, png)
  await backup.connect()
  try {
    await backup.query("SELECT pg_advisory_lock(hashtextextended('ijshub:files', 0))")
    await sequelize.transaction(transaction => queueFileDeletion([url], transaction))
    expect(await FileDeletion.count()).toBe(1)
    expect(await cleanupFiles()).toMatchObject({ deleted: 0, deferred: 'backup' })
    expect((await fs.stat(file)).size).toBe(png.length)
  } finally { await backup.end() }
  expect((await cleanupFiles()).deleted).toBe(1)
  await expect(fs.stat(file)).rejects.toMatchObject({ code: 'ENOENT' })
})
test.each(['/uploads/properties/../../secret', '/uploads/avatars/..', 'https://cdn.example.com/image.png'])('cleanup refuses unsafe or external URL %s', (url) => {
  expect(localFilePath(url)).toBeNull()
})

test('commission snapshots and audit records survive later price and rate edits', async () => {
  const rate = await tariffsService.upsertRate({ propertyId: property.id, category: 'apartments', commissionFrom: '3.125', commissionTo: null }, admin.id)
  const created = await application()
  expect(created.commissionRateId).toBe(rate.id)
  expect(Number(created.commissionRatePercent)).toBe(3.125)
  expect(Number(created.commissionBasePrice)).toBe(1000000)
  expect(Number(created.commissionAmount)).toBe(31250)
  expect((await call('patch', `/properties/${property.id}`).send({ price: 2000000 })).status).toBe(200)
  await tariffsService.upsertRate({ propertyId: property.id, category: 'apartments', commissionFrom: '5', commissionTo: null }, admin.id)
  const saved = await Application.findByPk(created.id)
  expect(Number(saved.commissionAmount)).toBe(31250)
  expect(Number(saved.commissionRatePercent)).toBe(3.125)
  expect(Number(saved.commissionBasePrice)).toBe(1000000)
  const history = await call('get', `/audit?entityType=property&entityId=${property.id}`)
  expect(history.status).toBe(200)
  expect(history.body.items[0]).toMatchObject({ actorId: admin.id, action: 'price_changed', before: { price: '1000000.00' }, after: { price: 2000000 } })
  expect(await AuditLog.count({ where: { entityType: 'tariff_rate' } })).toBe(2)
  expect((await call('get', '/audit', agent)).status).toBe(403)
})
test('audit changes roll back with their financial record', async () => {
  jest.spyOn(Property.prototype, 'update').mockRejectedValueOnce(new Error('write failed'))
  expect((await call('patch', `/properties/${property.id}`).send({ price: 42 })).status).toBe(500)
  expect(await AuditLog.count()).toBe(0)
  expect(Number((await property.reload()).price)).toBe(1000000)
})
test.each([['1.00', '0.500', '0.01'], ['1.01', '0.500', '0.01'], ['999999999999.99', '100.000', '999999999999.99'], ['10.10', '3.125', '0.32']])('exact decimal commission: price %s and rate %s', (price, commissionFrom, amount) => {
  expect(commissionSnapshot({ price }, { id: 1, commissionFrom }).commissionAmount).toBe(amount)
})

test('support list retains the customer identity after an admin reply', async () => {
  const roomId = `user:${agent.id}`
  await saveSupportMessage(roomId, { text: 'Вопрос' }, agent)
  await saveSupportReply({ roomId, text: 'Ответ' }, admin)
  const response = await call('get', '/support/chats?limit=10')
  expect(response.status).toBe(200)
  expect(response.body[0]).toMatchObject({ roomId, senderEmail: agent.email, lastMessage: 'Ответ', unreadCount: 1, isResolved: false })
})
test('support pagination uses stable boundaries and enforces room ownership', async () => {
  const roomId = `user:${agent.id}`
  const rows = await ChatMessage.bulkCreate([1, 2, 3, 4].map((n) => ({ roomId, senderId: agent.id, text: String(n), createdAt: new Date('2026-01-01') })))
  const url = `/support/history?roomId=${encodeURIComponent(roomId)}`
  expect((await call('get', url, other)).status).toBe(403)
  const last = await call('get', `${url}&limit=2`, agent)
  expect(last.body.map((m) => m.id)).toEqual(rows.slice(2).map((m) => m.id))
  const previous = await call('get', `${url}&limit=2&beforeId=${last.body[0].id}`, agent)
  expect(previous.body.map((m) => m.id)).toEqual(rows.slice(0, 2).map((m) => m.id))
  expect((await call('get', `${url}&beforeId=99999`, agent)).status).toBe(400)
  expect((await call('get', `${url}&limit=201`, agent)).status).toBe(400)
})
test('application chat lists query only latest messages and preserve tenant isolation', async () => {
  const own = await application()
  const unrelated = await application(other)
  const time = new Date('2026-01-01')
  const rows = await ApplicationChatMessage.bulkCreate([1, 2, 3, 4].map((n) => ({ applicationId: own.id, senderId: agent.id, senderRole: agent.role, text: String(n), createdAt: time })))
  await ApplicationChatMessage.create({ applicationId: unrelated.id, senderId: other.id, senderRole: other.role, text: 'Секрет' })
  const list = await call('get', '/applications/chat/chats?limit=10', agent)
  expect(list.status).toBe(200)
  expect(list.body).toHaveLength(1)
  expect(list.body[0].lastMessage).toBe('4')
  const latest = await call('get', `/applications/${own.id}/chat/messages?limit=2`, agent)
  expect(latest.body.map((m) => m.id)).toEqual(rows.slice(2).map((m) => m.id))
  const next = await call('get', `/applications/${own.id}/chat/messages?limit=2&beforeId=${rows[2].id}`, agent)
  expect(next.body.map((m) => m.id)).toEqual(rows.slice(0, 2).map((m) => m.id))
  expect((await call('get', `/applications/${unrelated.id}/chat/messages?limit=2`, agent)).status).toBe(403)
})

test('reminders catch up after downtime and concurrent workers deliver once', async () => {
  const item = await event(30)
  await eventsService.registerForEvent(item.id, agent)
  expect(await EventReminder.count({ where: { status: 'pending' } })).toBe(1)
  const results = await Promise.all([sendEventReminders(), sendEventReminders()])
  expect(results.reduce((n, result) => n + result.created, 0)).toBe(1)
  expect(await Notification.count({ where: { type: 'event_reminder', userId: agent.id } })).toBe(1)
  expect(await EventReminder.count({ where: { status: 'delivered' } })).toBe(1)
  expect((await sendEventReminders()).created).toBe(0)
})
test('legacy registrations receive reminders without recreating registrations', async () => {
  const item = await event(20)
  await EventRegistration.create({ eventId: item.id, agentId: agent.id, status: 'approved' })
  expect((await sendEventReminders()).created).toBe(1)
})
test('rejected registrations do not receive reminders and can be approved again', async () => {
  const item = await event(20)
  const reg = await eventsService.registerForEvent(item.id, agent)
  await eventsService.updateRegistrationStatus(reg.id, { status: 'rejected' })
  expect((await sendEventReminders()).created).toBe(0)
  expect(await EventReminder.count({ where: { status: 'cancelled' } })).toBe(1)
  await eventsService.updateRegistrationStatus(reg.id, { status: 'approved' })
  expect((await sendEventReminders()).created).toBe(1)
})
test('started events cancel overdue reminders', async () => {
  const item = await event(20)
  await eventsService.registerForEvent(item.id, agent)
  await item.update({ startAt: new Date(Date.now() - 1000) })
  expect((await sendEventReminders()).created).toBe(0)
  expect(await EventReminder.count({ where: { status: 'cancelled' } })).toBe(1)
})
test('failed delivery leaves a durable pending task for retry', async () => {
  const item = await event(20)
  await eventsService.registerForEvent(item.id, agent)
  jest.spyOn(Notification, 'findOrCreate').mockRejectedValueOnce(new Error('notification write failed'))
  await expect(sendEventReminders()).rejects.toThrow('notification write failed')
  expect(await EventReminder.count({ where: { status: 'pending' } })).toBe(1)
  expect((await sendEventReminders()).created).toBe(1)
})
test('the previous reminder format is not delivered again after upgrade', async () => {
  const item = await event(20)
  await EventRegistration.create({ eventId: item.id, agentId: agent.id })
  await Notification.create({ userId: agent.id, type: 'event_reminder', key: `event_reminder:${item.id}:60m`, text: 'Old reminder', meta: { startAt: item.startAt } })
  expect((await sendEventReminders()).created).toBe(0)
  expect(await Notification.count({ where: { type: 'event_reminder' } })).toBe(1)
  expect(await EventReminder.count({ where: { status: 'delivered' } })).toBe(1)
})
test('rescheduled events have a separate reminder occurrence', async () => {
  const item = await event(20)
  await eventsService.registerForEvent(item.id, agent)
  expect((await sendEventReminders()).created).toBe(1)
  await item.update({ startAt: new Date(Date.now() + 40 * 60000) })
  expect((await sendEventReminders()).created).toBe(1)
  expect(await Notification.count({ where: { type: 'event_reminder' } })).toBe(2)
})

test('database resets require the exact database name and explicit opt-in', () => {
  for (const env of [{}, { NODE_ENV: 'production', ALLOW_DB_RESET: '1', RESET_DATABASE_NAME: 'fixture_test' },
    { NODE_ENV: 'test', ALLOW_DB_RESET: '1', RESET_DATABASE_NAME: 'wrong_test' }, { NODE_ENV: 'development', RESET_DATABASE_NAME: 'fixture_test' }]) {
    expect(() => assertResetAllowed(env, 'fixture_test')).toThrow()
  }
  expect(() => assertResetAllowed({ NODE_ENV: 'development', ALLOW_DB_RESET: '1', RESET_DATABASE_NAME: 'fixture_test' }, 'fixture_test')).not.toThrow()
})
test('temporary refresh failures retain cookies and allow a retry', async () => {
  const session = await login()
  jest.spyOn(sequelize, 'transaction').mockRejectedValueOnce(new Error('database unavailable'))
  const failed = await withCookies('/auth/refresh', session)
  expect(failed.status).toBe(500)
  expect(failed.headers['set-cookie']).toBeUndefined()
  expect((await withCookies('/auth/refresh', session)).status).toBe(200)
})
test('successful logins do not use the failed-login quota; exhausting it leaves refresh and logout available', async () => {
  for (let i = 0; i < 21; i++) await login()
  const session = await login()
  const attempt = (email, password = 'wrong-password') => request(app).post('/auth/login').send({ email, password })
  // The account quota stops guessing one password from many addresses.
  for (let i = 0; i < 10; i++) expect((await attempt(agent.email)).status).toBe(401)
  expect((await attempt(agent.email, 'test_password')).status).toBe(429)
  // The address quota still covers guessing across accounts.
  for (let i = 0; i < 9; i++) expect((await attempt(`unknown-${i}@test.com`)).status).toBe(401)
  expect((await attempt(other.email, 'test_password')).status).toBe(429)
  const refresh = await withCookies('/auth/refresh', session)
  expect(refresh.status).toBe(200)
  const cookies = refresh.headers['set-cookie'].map((cookie) => cookie.split(';')[0])
  const csrf = cookies.find((cookie) => cookie.startsWith('csrf_token=')).split('=')[1]
  expect((await withCookies('/auth/logout', { cookies, csrf })).status).toBe(200)
})

test('Unicode property documents remain downloadable', async () => {
  const response = await call('post', `/properties/${property.id}/documents`).attach('document', pdf, { filename: 'Договор.pdf', contentType: 'application/pdf' })
  expect(response.status).toBe(201)
  const doc = response.body.documents[0]
  track(doc.url)
  expect((await request(app).get(encodeURI(doc.url))).status).toBe(200)
  expect((await call('delete', `/properties/documents/${doc.id}`)).status).toBe(200)
  expect((await request(app).get(encodeURI(doc.url))).status).toBe(404)
})
test('shared legacy image files are kept until their last reference is removed', async () => {
  const url = '/uploads/properties/reliability-shared.png'
  const file = track(url)
  await fs.writeFile(file, png)
  const second = await Property.create({ title: 'Другой дом', region: 'Р', city: 'Г', developerId: developer.id })
  const image = await PropertyImage.create({ propertyId: property.id, url })
  const otherImage = await PropertyImage.create({ propertyId: second.id, url })
  expect((await call('delete', `/properties/images/${image.id}`)).status).toBe(200)
  expect((await fs.stat(file)).size).toBe(png.length)
  expect((await call('delete', `/properties/images/${otherImage.id}`)).status).toBe(200)
  await expect(fs.stat(file)).rejects.toMatchObject({ code: 'ENOENT' })
})
test('replacing an event cover removes the old file and retains the new cover', async () => {
  const item = await event()
  const first = await call('post', `/events/${item.id}/image`).attach('image', png, 'first.png')
  expect(first.status).toBe(201)
  const old = track(first.body.coverImageUrl)
  const second = await call('post', `/events/${item.id}/image`).attach('image', png, 'second.png')
  expect(second.status).toBe(201)
  track(second.body.coverImageUrl)
  await expect(fs.stat(old)).rejects.toMatchObject({ code: 'ENOENT' })
})
test('a price update that keeps the monetary value does not create a change record', async () => {
  expect((await call('patch', `/properties/${property.id}`).send({ price: 1000000 })).status).toBe(200)
  expect(await AuditLog.count()).toBe(0)
})
test('administrator creation uses the supplied password and never overwrites an account', async () => {
  const { createAdmin } = require('../src/create-admin')
  const oldEmail = process.env.ADMIN_EMAIL
  const oldPassword = process.env.ADMIN_PASSWORD
  process.env.ADMIN_EMAIL = 'bootstrap-admin@test.com'
  process.env.ADMIN_PASSWORD = 'Test-only-password-1234'
  try {
    await createAdmin()
    const user = await User.findOne({ where: { email: process.env.ADMIN_EMAIL } })
    expect(user.role).toBe('admin')
    expect(await bcrypt.compare(process.env.ADMIN_PASSWORD, user.passwordHash)).toBe(true)
    const originalHash = user.passwordHash
    await expect(createAdmin()).rejects.toMatchObject({ status: 409 })
    expect((await user.reload()).passwordHash).toBe(originalHash)
    process.env.ADMIN_PASSWORD = 'short'
    await expect(createAdmin()).rejects.toThrow('Set ADMIN_EMAIL and ADMIN_PASSWORD')
  } finally {
    if (oldEmail === undefined) delete process.env.ADMIN_EMAIL
    else process.env.ADMIN_EMAIL = oldEmail
    if (oldPassword === undefined) delete process.env.ADMIN_PASSWORD
    else process.env.ADMIN_PASSWORD = oldPassword
  }
})

test('valid Office documents pass archive verification', async () => {
  const res = await call('post', `/properties/${property.id}/documents`).attach('document', path.join(__dirname, 'fixtures/minimal.docx'))
  expect(res.status).toBe(201)
  track(res.body.documents[0].url)
})
test('a generic ZIP renamed as Office document is rejected', async () => {
  const buffer = Buffer.from(await fs.readFile(path.join(__dirname, 'fixtures/minimal.docx')))
  const offset = buffer.lastIndexOf(Buffer.from('word/document.xml'))
  buffer.write('word/xxxxxxxx.xml', offset, 'ascii')
  const res = await call('post', `/properties/${property.id}/documents`).attach('document', buffer, {
    filename: 'fake.docx', contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  })
  expect(res.status).toBe(400)
})
