const request = require('supertest')
const fs = require('fs/promises')
const path = require('path')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const app = require('../src/app')
const { sequelize } = require('../src/db')
const {
  User, AuthSession, Property, Application, Notification, Event, EventRegistration, EventReminder,
  ChatMessage, SupportRequest, PasswordResetToken, AuditLog, FileDeletion
} = require('../src/models')
const { syncAndTruncateExcept } = require('./testDb')
const { hashToken } = require('../src/utils/authTokens')
const { outbox, mailMode } = require('../src/utils/mailer')
const { sendEventReminders } = require('../src/jobs/eventReminders')
const { cleanupAuthSessions } = require('../src/jobs/sessionCleanup')

let admin, developer, property, passwordHash
const tokens = new Map()
let counter = 0

function call (method, url, user) {
  return request(app)[method](url).set('Authorization', `Bearer ${tokens.get(user.id)}`)
}
async function makeUser (role, extra = {}) {
  counter++
  const user = await User.create({
    role,
    email: `life-${counter}@test.com`,
    passwordHash,
    firstName: 'Имя',
    lastName: 'Фамилия',
    phone: `+7 900 100-${String(counter).padStart(2, '0')}-00`,
    companyName: role === 'individual' ? null : 'Компания',
    developerApproved: role === 'developer',
    ...extra
  })
  const session = await AuthSession.create({ userId: user.id, refreshTokenHash: hashToken(`life-${user.id}`), expiresAt: new Date(Date.now() + 3600000) })
  tokens.set(user.id, jwt.sign({ sub: user.id, sid: session.id }, process.env.JWT_SECRET, { expiresIn: '1h' }))
  return user
}
function tokenFrom (message) {
  return decodeURIComponent(/#token=([^\s"<]+)/.exec(message.text)[1])
}
function forgot (email) {
  return request(app).post('/auth/password/forgot').send({ email })
}
function login (email, password = 'test_password') {
  return request(app).post('/auth/login').send({ email, password })
}

beforeAll(async () => {
  await syncAndTruncateExcept(sequelize)
  passwordHash = await bcrypt.hash('test_password', 4)
  admin = await makeUser('admin')
  developer = await makeUser('developer')
})
beforeEach(async () => {
  outbox.splice(0)
  property = await Property.create({ title: 'Дом', region: 'Р', city: 'Г', developerId: developer.id, price: '1000000.00' })
})
afterAll(async () => sequelize.close())

describe('password reset', () => {
  test('the answer does not reveal whether an account exists', async () => {
    const unknown = await forgot('nobody@test.com')
    expect(unknown.status).toBe(200)
    expect(outbox).toHaveLength(0)
    const user = await makeUser('agent')
    const known = await forgot(user.email.toUpperCase())
    expect(known.status).toBe(200)
    expect(known.body.message).toBe(unknown.body.message)
    expect(outbox).toHaveLength(1)
    expect(outbox[0].to).toBe(user.email)
    expect(outbox[0].text).toContain('/reset-password#token=')
  })

  test('a reset link changes the password once, ends all sessions and invalidates older links', async () => {
    const user = await makeUser('agent')
    await forgot(user.email)
    await forgot(user.email)
    const [older, latest] = outbox.map(tokenFrom)
    const reset = (token, password = 'new_password_1') => request(app).post('/auth/password/reset').send({ token, password })
    expect((await reset(older)).status).toBe(400)
    expect((await reset(latest, 'short')).status).toBe(400)
    const res = await reset(latest)
    expect(res.status).toBe(200)
    expect((await call('get', '/users/me', user)).status).toBe(401)
    expect(await AuthSession.count({ where: { userId: user.id } })).toBe(0)
    expect((await login(user.email)).status).toBe(401)
    expect((await login(user.email, 'new_password_1')).status).toBe(200)
    expect((await reset(latest, 'another_password')).status).toBe(400)
    expect(outbox.at(-1).subject).toMatch(/Пароль изменён/)
  })

  test('an expired link is rejected and old links are cleaned up', async () => {
    const user = await makeUser('agent')
    await forgot(user.email)
    const token = tokenFrom(outbox[0])
    await PasswordResetToken.update({ expiresAt: new Date(Date.now() - 2 * 86400000) }, { where: { userId: user.id } })
    expect((await request(app).post('/auth/password/reset').send({ token, password: 'new_password_1' })).status).toBe(400)
    await cleanupAuthSessions()
    expect(await PasswordResetToken.count({ where: { userId: user.id } })).toBe(0)
  })

  test('one mailbox receives at most three reset emails per hour', async () => {
    const user = await makeUser('agent')
    for (let i = 0; i < 3; i++) expect((await forgot(user.email)).status).toBe(200)
    expect((await forgot(user.email)).status).toBe(429)
    expect(outbox).toHaveLength(3)
  })

  test('production without SMTP disables delivery instead of logging links', () => {
    expect(mailMode({ NODE_ENV: 'production' })).toBe('disabled')
    expect(mailMode({ NODE_ENV: 'production', SMTP_URL: 'smtps://u:p@smtp.example.ru' })).toBe('smtp')
    expect(mailMode({ NODE_ENV: 'development' })).toBe('log')
  })
})

describe('account deletion', () => {
  test('requires the password and is blocked while a deal is in progress', async () => {
    const agent = await makeUser('agent')
    const application = await Application.create({ propertyId: property.id, agentId: agent.id, status: 'confirmed', clientPhone: '+7 911 000-00-01' })
    expect((await call('delete', '/users/me', agent).send({ password: 'wrong' })).status).toBe(400)
    expect((await call('delete', '/users/me', agent).send({ password: 'test_password' })).status).toBe(409)
    await application.update({ status: 'done' })
    expect((await call('delete', '/users/me', agent).send({ password: 'test_password' })).status).toBe(200)
  })

  test('anonymizes the account, withdraws pending applications and frees the email', async () => {
    const agent = await makeUser('agent', { avatarUrl: '/uploads/avatars/life-avatar.png', marketingConsentGiven: true })
    const email = agent.email
    const avatar = path.join(__dirname, '../uploads/avatars/life-avatar.png')
    await fs.writeFile(avatar, 'avatar')
    const pending = await Application.create({ propertyId: property.id, agentId: agent.id, status: 'sent', clientFullName: 'Клиент', clientPhone: '+7 911 000-00-02', expiresAt: new Date(Date.now() + 86400000) })
    const event = await Event.create({ title: 'Скоро', startAt: new Date(Date.now() + 86400000), createdBy: admin.id })
    await EventRegistration.create({ eventId: event.id, agentId: agent.id })
    await ChatMessage.create({ roomId: `user:${agent.id}`, senderId: agent.id, senderName: 'Имя', senderEmail: email, text: 'Вопрос', isAdmin: false })
    await SupportRequest.create({ name: 'Имя', email, message: 'Помогите', ip: '10.0.0.1' })
    await Notification.create({ userId: agent.id, type: 'test', text: 'x' })

    const res = await call('delete', '/users/me', agent).send({ password: 'test_password' })
    expect(res.status).toBe(200)
    expect(res.headers['set-cookie'].join(';')).toMatch(/refresh_token=;/)

    const deleted = await User.findByPk(agent.id)
    expect(deleted).toMatchObject({ email: `deleted-${agent.id}@deleted.invalid`, phone: null, avatarUrl: null, marketingConsentGiven: false })
    expect(deleted.fullName).toBe('Удалённый пользователь')
    expect(deleted.deletedAt).not.toBeNull()
    expect((await pending.reload()).status).toBe('cancelled')
    expect(await Notification.count({ where: { userId: developer.id, type: 'application_status' } })).toBeGreaterThan(0)
    expect(await EventRegistration.count({ where: { agentId: agent.id } })).toBe(0)
    expect(await ChatMessage.findOne({ where: { senderId: agent.id } })).toMatchObject({ senderName: null, senderEmail: null })
    expect(await SupportRequest.count({ where: { email } })).toBe(0)
    expect(await Notification.count({ where: { userId: agent.id } })).toBe(0)
    // The old avatar is removed from disk after commit.
    for (let i = 0; i < 100 && await fs.access(avatar).then(() => true, () => false); i++) await new Promise((resolve) => setTimeout(resolve, 20))
    await expect(fs.access(avatar)).rejects.toThrow()
    expect(await FileDeletion.count()).toBe(0)
    expect(await AuditLog.count({ where: { entityType: 'user', entityId: agent.id, action: 'account_deleted' } })).toBe(1)
    expect((await call('get', '/users/me', agent)).status).toBe(401)
    expect((await login(email)).status).toBe(401)

    const again = await request(app).post('/auth/register').send({
      email,
      password: 'test_password',
      role: 'agent',
      phone: agent.phone,
      companyName: 'Компания',
      firstName: 'Новый',
      consent: { legal: { accepted: true, documentVersion: '1', termsPath: '/terms', privacyPath: '/privacy' }, marketing: { accepted: false } }
    })
    expect(again.status).toBe(201)
  })

  test('own client data of an individual is removed from non-completed applications', async () => {
    const person = await makeUser('individual')
    const done = await Application.create({ propertyId: property.id, agentId: person.id, status: 'done', clientFullName: 'Фамилия Имя', clientPhone: person.phone })
    const rejected = await Application.create({ propertyId: property.id, agentId: person.id, status: 'rejected', clientFullName: 'Фамилия Имя', clientPhone: person.phone })
    expect((await call('delete', '/users/me', person).send({ password: 'test_password' })).status).toBe(200)
    expect((await rejected.reload()).clientPhone).toBeNull()
    expect((await done.reload()).clientPhone).toBe(person.phone)
  })

  test('the only administrator and a developer with objects cannot delete themselves', async () => {
    expect((await call('delete', '/users/me', admin).send({ password: 'test_password' })).status).toBe(409)
    expect((await call('delete', '/users/me', developer).send({ password: 'test_password' })).status).toBe(409)
    const lonely = await makeUser('developer')
    expect((await call('delete', '/users/me', lonely).send({ password: 'test_password' })).status).toBe(200)
    const list = await call('get', '/users/developers', admin)
    expect(list.body.map((user) => user.id)).not.toContain(lonely.id)
    const deputy = await makeUser('admin')
    expect((await call('delete', '/users/me', deputy).send({ password: 'test_password' })).status).toBe(200)
  })
})

describe('event management', () => {
  async function eventWith (agents, extra = {}) {
    const event = await Event.create({ title: 'Семинар', startAt: new Date(Date.now() + 30 * 60000), createdBy: admin.id, capacity: 5, ...extra })
    for (const agent of agents) {
      await EventRegistration.create({ eventId: event.id, agentId: agent.id, status: 'approved' })
      await EventReminder.create({ eventId: event.id, agentId: agent.id, startAt: event.startAt, minutesBefore: 60, dueAt: new Date(event.startAt.getTime() - 3600000) })
    }
    return event
  }

  test('rescheduling moves reminders and informs participants', async () => {
    const agent = await makeUser('agent')
    const event = await eventWith([agent])
    const startAt = new Date(Date.now() + 3 * 86400000)
    const res = await call('patch', `/events/${event.id}`, admin).send({ startAt: startAt.toISOString(), location: 'Москва' })
    expect(res.status).toBe(200)
    const reminders = await EventReminder.findAll({ where: { eventId: event.id }, order: [['id', 'ASC']] })
    expect(reminders.map((r) => r.status)).toEqual(['cancelled', 'pending'])
    expect(reminders[1].startAt.getTime()).toBe(startAt.getTime())
    const [note] = await Notification.findAll({ where: { userId: agent.id, type: 'event_updated' } })
    expect(note.text).toMatch(/Москва/)
    expect((await call('patch', `/events/${event.id}`, admin).send({ title: 'Новое название' })).status).toBe(200)
    expect(await Notification.count({ where: { userId: agent.id, type: 'event_updated' } })).toBe(1)
  })

  test('edits respect capacity, dates and the start of the event', async () => {
    const agents = [await makeUser('agent'), await makeUser('agent')]
    const event = await eventWith(agents)
    expect((await call('patch', `/events/${event.id}`, admin).send({ capacity: 1 })).status).toBe(409)
    expect((await call('patch', `/events/${event.id}`, admin).send({ endAt: new Date(Date.now() + 60000).toISOString() })).status).toBe(400)
    expect((await call('patch', `/events/${event.id}`, admin).send({ startAt: new Date(Date.now() - 1000).toISOString() })).status).toBe(400)
    await event.update({ startAt: new Date(Date.now() - 1000) })
    expect((await call('patch', `/events/${event.id}`, admin).send({ startAt: new Date(Date.now() + 86400000).toISOString() })).status).toBe(409)
    expect((await call('patch', `/events/${event.id}`, admin).send({ description: 'Запись' })).status).toBe(200)
    expect((await call('patch', `/events/${event.id}`, agents[0]).send({ title: 'x' })).status).toBe(403)
  })

  test('cancellation closes registration, stops reminders and informs participants', async () => {
    const agent = await makeUser('agent')
    const newcomer = await makeUser('agent')
    const event = await eventWith([agent])
    const res = await call('post', `/events/${event.id}/cancel`, admin).send({ reason: 'Спикер заболел' })
    expect(res.status).toBe(200)
    expect(res.body.cancelledAt).not.toBeNull()
    expect(res.body.cancelReason).toBe('Спикер заболел')
    expect((await call('post', `/events/${event.id}/cancel`, admin).send({})).status).toBe(200)
    expect(await Notification.count({ where: { userId: agent.id, type: 'event_cancelled' } })).toBe(1)
    expect((await EventReminder.findOne({ where: { eventId: event.id } })).status).toBe('cancelled')
    expect((await call('post', `/events/${event.id}/register`, newcomer)).status).toBe(409)
    expect((await call('patch', `/events/${event.id}`, admin).send({ title: 'x' })).status).toBe(409)
    expect((await sendEventReminders({ now: new Date(event.startAt.getTime() - 60000) })).created).toBe(0)
  })

  test('a participant cancels their own registration before the start', async () => {
    const agent = await makeUser('agent')
    const other = await makeUser('agent')
    const event = await eventWith([agent], { capacity: 1 })
    expect((await call('post', `/events/${event.id}/register`, other)).status).toBe(409)
    expect((await call('delete', `/events/${event.id}/register`, other)).status).toBe(404)
    expect((await call('delete', `/events/${event.id}/register`, agent)).status).toBe(200)
    expect((await EventReminder.findOne({ where: { eventId: event.id, agentId: agent.id } })).status).toBe('cancelled')
    expect(await Notification.count({ where: { userId: admin.id, type: 'event_registration_cancelled' } })).toBeGreaterThan(0)
    expect((await call('post', `/events/${event.id}/register`, other)).status).toBe(201)
    await event.update({ startAt: new Date(Date.now() - 1000) })
    expect((await call('delete', `/events/${event.id}/register`, other)).status).toBe(409)
  })
})
