const request = require('supertest')
const jwt = require('jsonwebtoken')
const app = require('../src/app')
const { sequelize } = require('../src/db')
const {
  User, AuthSession, Property, Application, Notification, AuditLog, Event, EventRegistration, EventReminder
} = require('../src/models')
const { syncAndTruncateExcept } = require('./testDb')
const { hashToken } = require('../src/utils/authTokens')
const { setIO } = require('../src/socket')
const { sendEventReminders } = require('../src/jobs/eventReminders')
const { cleanupAuthSessions } = require('../src/jobs/sessionCleanup')

let admin, agent, second, individual, developer, pendingDeveloper, property
const tokens = new Map()

function call (method, url, user) {
  return request(app)[method](url).set('Authorization', `Bearer ${tokens.get(user.id)}`)
}
function apply (user = agent, phone = '+7 999 111-22-33') {
  return call('post', '/applications', user).send({ propertyId: property.id, clientFullName: 'Клиент Тестовый', clientPhone: phone })
}
function setStatus (id, status, user = developer) {
  return call('patch', `/applications/${id}/status`, user).send({ status })
}
function notesFor (user, type) {
  return Notification.findAll({ where: { userId: user.id, ...(type ? { type } : {}) } })
}

beforeAll(async () => {
  await syncAndTruncateExcept(sequelize)
  const users = await User.bulkCreate([
    { role: 'admin', email: 'rules-admin@test.com' },
    { role: 'agent', email: 'rules-agent@test.com', companyName: 'Агентство', phone: '+7 900 000-00-01' },
    { role: 'agent', email: 'rules-second@test.com', companyName: 'Агентство 2', phone: '+7 900 000-00-02' },
    { role: 'individual', email: 'rules-person@test.com', firstName: 'Иван', lastName: 'Петров', phone: '+7 900 000-00-03' },
    { role: 'developer', email: 'rules-dev@test.com', companyName: 'Застройщик', developerApproved: true },
    { role: 'developer', email: 'rules-pending@test.com', companyName: 'Новый', developerApproved: false }
  ].map((user) => ({ passwordHash: 'fixture', ...user })))
  ;[admin, agent, second, individual, developer, pendingDeveloper] = users
  for (const user of users) {
    const session = await AuthSession.create({ userId: user.id, refreshTokenHash: hashToken(`rules-${user.id}`), expiresAt: new Date(Date.now() + 3600000) })
    tokens.set(user.id, jwt.sign({ sub: user.id, sid: session.id }, process.env.JWT_SECRET, { expiresIn: '1h' }))
  }
})
beforeEach(async () => {
  await sequelize.query('TRUNCATE properties, applications, notifications, audit_logs, events RESTART IDENTITY CASCADE')
  property = await Property.create({ title: 'Дом у леса', region: 'Область', city: 'Город', developerId: developer.id, price: '5000000.00' })
})
afterEach(() => setIO(null))
afterAll(async () => sequelize.close())

describe('client fixation', () => {
  test('an active application fixes the client on the object for its author, in any phone format', async () => {
    expect((await apply(agent, '+7 999 111-22-33')).status).toBe(201)
    const duplicate = await apply(second, '8 (999) 111-22-33')
    expect(duplicate.status).toBe(409)
    expect(duplicate.body.error).toMatch(/закреплён за другим агентом/)
    expect((await apply(agent, '89991112233')).body.error).toMatch(/уже есть активная заявка/)
    expect((await apply(second, '+7 999 111-22-34')).status).toBe(201)
  })

  test('legacy unformatted phones are matched and a closed application releases the client', async () => {
    const legacy = await Application.create({ propertyId: property.id, agentId: agent.id, status: 'sent', clientPhone: '89995556677', expiresAt: new Date(Date.now() + 86400000) })
    expect((await apply(second, '+7 999 555-66-77')).status).toBe(409)
    expect((await call('patch', `/applications/${legacy.id}/cancel`, agent).send({})).status).toBe(200)
    expect((await apply(second, '+7 999 555-66-77')).status).toBe(201)
  })

  test('changing the client to one fixed by another agent is rejected', async () => {
    await apply(agent, '+7 999 111-22-33')
    const own = await apply(second, '+7 999 111-22-44')
    const res = await call('patch', `/applications/${own.body.id}/client`, second).send({ clientFullName: 'Другой', clientPhone: '+7 999 111-22-33' })
    expect(res.status).toBe(409)
  })
})

describe('cancellation by the author', () => {
  test('the author withdraws a pending application; the developer and administrators are notified', async () => {
    const created = await apply()
    expect((await call('patch', `/applications/${created.body.id}/cancel`, second).send({})).status).toBe(403)
    expect((await call('patch', `/applications/${created.body.id}/cancel`, developer).send({})).status).toBe(403)
    const res = await call('patch', `/applications/${created.body.id}/cancel`, agent).send({ comment: 'Клиент передумал' })
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('cancelled')
    const [devNote] = await notesFor(developer, 'application_status')
    expect(devNote.meta).toMatchObject({ applicationId: created.body.id, status: 'cancelled' })
    expect(await notesFor(admin, 'application_status')).toHaveLength(1)
    expect((await call('patch', `/applications/${created.body.id}/cancel`, agent).send({})).status).toBe(409)
    expect((await setStatus(created.body.id, 'confirmed')).status).toBe(409)
  })

  test('withdrawing a confirmed application releases the reservation', async () => {
    const created = await apply()
    await setStatus(created.body.id, 'confirmed')
    expect((await property.reload()).saleStatus).toBe('reserved')
    expect((await call('patch', `/applications/${created.body.id}/cancel`, agent).send({})).status).toBe(200)
    expect((await property.reload()).saleStatus).toBe('available')
  })

  test('a completed or overdue application cannot be withdrawn; managers cannot set cancelled', async () => {
    const created = await apply()
    expect((await setStatus(created.body.id, 'cancelled')).status).toBe(400)
    await setStatus(created.body.id, 'done')
    expect((await call('patch', `/applications/${created.body.id}/cancel`, agent).send({})).status).toBe(409)
    const overdue = await Application.create({ propertyId: property.id, agentId: second.id, status: 'sent', clientPhone: '+7 999 000-11-22', expiresAt: new Date(Date.now() - 1000) })
    expect((await call('patch', `/applications/${overdue.id}/cancel`, second).send({})).status).toBe(409)
    expect((await overdue.reload()).status).toBe('expired')
  })
})

describe('client data changes', () => {
  test('client data can change only while the application is pending, and the change is audited', async () => {
    const created = await apply()
    const url = `/applications/${created.body.id}/client`
    const changed = await call('patch', url, agent).send({ clientFullName: 'Новый Клиент', clientPhone: '8 999 444-55-66' })
    expect(changed.status).toBe(200)
    expect(changed.body.clientPhone).toBe('+7 999 444-55-66')
    const [entry] = await AuditLog.findAll({ where: { entityType: 'application', entityId: created.body.id } })
    expect(entry).toMatchObject({ action: 'client_changed', actorId: agent.id })
    expect(entry.before.clientPhone).toBe('+7 999 111-22-33')
    const audit = await call('get', `/audit?entityType=application&entityId=${created.body.id}`, admin)
    expect(audit.body.total).toBe(1)
    await setStatus(created.body.id, 'confirmed')
    expect((await call('patch', url, agent).send({ clientFullName: 'Ещё', clientPhone: '+7 999 444-55-67' })).status).toBe(409)
  })

  test('an individual applies with their profile data and cannot replace it', async () => {
    const created = await call('post', '/applications', individual).send({ propertyId: property.id, clientFullName: 'Чужой', clientPhone: '+7 911 000-00-00' })
    expect(created.status).toBe(201)
    expect(created.body).toMatchObject({ clientFullName: 'Петров Иван', clientPhone: '+7 900 000-00-03' })
    const res = await call('patch', `/applications/${created.body.id}/client`, individual).send({ clientFullName: 'Чужой', clientPhone: '+7 911 000-00-00' })
    expect(res.status).toBe(403)
  })
})

describe('notifications', () => {
  test('an administrator status change also informs the developer; extension informs the author', async () => {
    const created = await apply()
    await call('patch', `/applications/${created.body.id}/extend`, developer).send({ days: 5 })
    expect(await notesFor(agent, 'application_extended')).toHaveLength(1)
    expect((await setStatus(created.body.id, 'confirmed', admin)).status).toBe(200)
    expect((await notesFor(developer, 'application_status')).map((n) => n.meta.status)).toEqual(['confirmed'])
    await setStatus(created.body.id, 'contract_signed', developer)
    expect(await notesFor(developer, 'application_status')).toHaveLength(1)
  })

  test('application chat messages notify the other side once per unread chat', async () => {
    const created = await apply()
    const url = `/applications/${created.body.id}/chat/messages`
    expect((await call('post', url, agent).send({ text: 'Здравствуйте' })).status).toBe(201)
    expect((await call('post', url, agent).send({ text: 'Есть вопрос' })).status).toBe(201)
    const adminNotes = await notesFor(admin, 'application_chat_message')
    expect(adminNotes).toHaveLength(1)
    expect(adminNotes[0].meta.applicationId).toBe(created.body.id)
    expect(await notesFor(agent, 'application_chat_message')).toHaveLength(0)
    expect((await call('post', url, admin).send({ text: 'Отвечаем' })).status).toBe(201)
    expect(await notesFor(agent, 'application_chat_message')).toHaveLength(1)
    await call('post', `/notifications/${adminNotes[0].id}/read`, admin)
    await call('post', url, agent).send({ text: 'Спасибо' })
    expect(await notesFor(admin, 'application_chat_message')).toHaveLength(2)
  })

  test('a notification created through findOrCreate is not published when the outer transaction rolls back', async () => {
    const emit = jest.fn()
    setIO({ to: () => ({ emit }) })
    await expect(sequelize.transaction(async (transaction) => {
      await Notification.findOrCreate({ where: { userId: agent.id, key: 'rollback-check' }, defaults: { type: 'test', text: 'x' }, transaction })
      throw new Error('rollback')
    })).rejects.toThrow('rollback')
    await new Promise((resolve) => setImmediate(resolve))
    expect(emit).not.toHaveBeenCalled()
    await sequelize.transaction(async (transaction) => {
      await Notification.findOrCreate({ where: { userId: agent.id, key: 'commit-check' }, defaults: { type: 'test', text: 'x' }, transaction })
    })
    expect(emit).toHaveBeenCalledTimes(1)
  })
})

describe('lists', () => {
  test('application, incoming and catalog lists support optional pagination', async () => {
    await apply(agent, '+7 999 000-00-01')
    await apply(agent, '+7 999 000-00-02')
    const legacy = await call('get', '/applications/mine', agent)
    expect(Array.isArray(legacy.body)).toBe(true)
    const page = await call('get', '/applications/mine?page=2&limit=1', agent)
    expect(page.body).toMatchObject({ total: 2, page: 2, limit: 1 })
    expect(page.body.items).toHaveLength(1)
    expect(page.body.items[0].history).toHaveLength(1)
    const incoming = await call('get', '/applications/incoming?page=1&limit=1&status=sent', developer)
    expect(incoming.body).toMatchObject({ total: 2, page: 1, limit: 1 })
    const other = await Property.create({ title: 'Чужой', region: 'Р', city: 'Г', developerId: pendingDeveloper.id })
    await Application.create({ propertyId: other.id, agentId: agent.id, status: 'sent', clientPhone: '+7 999 000-00-09' })
    expect((await call('get', '/applications/incoming?page=1&limit=10', developer)).body.total).toBe(2)
    expect((await call('get', `/applications/incoming?page=1&limit=10&developerId=${pendingDeveloper.id}`, admin)).body.total).toBe(1)
    expect((await call('get', '/applications/mine?page=1', agent)).status).toBe(400)
    const catalog = await request(app).get('/properties?page=1&limit=1')
    expect(catalog.body).toMatchObject({ total: 2, page: 1, limit: 1 })
    expect(catalog.body.items).toHaveLength(1)
  })

  test('validation errors are reported in Russian', async () => {
    const res = await call('post', '/applications', agent).send({ propertyId: 'abc' })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('Поле «Объект» должно быть числом')
  })
})

describe('properties', () => {
  test('objects can be assigned only to approved developers', async () => {
    const res = await call('post', '/properties', admin).send({ title: 'Дом', region: 'Р', city: 'Г', developerId: pendingDeveloper.id })
    expect(res.status).toBe(409)
    expect((await call('patch', `/properties/${property.id}`, admin).send({ developerId: pendingDeveloper.id })).status).toBe(409)
    expect((await call('patch', `/properties/${property.id}`, admin).send({ developerId: developer.id, title: 'Новое' })).status).toBe(200)
  })

  test('a sale recorded on the object closes pending applications', async () => {
    const created = await apply()
    const res = await call('patch', `/properties/${property.id}`, developer).send({ saleStatus: 'sold' })
    expect(res.status).toBe(200)
    expect((await Application.findByPk(created.body.id)).status).toBe('rejected')
    expect((await notesFor(agent, 'application_status')).map((n) => n.meta.status)).toEqual(['rejected'])
  })
})

describe('profile', () => {
  test('the profile form may send an empty or unchanged legacy phone', async () => {
    await User.update({ phone: '12345' }, { where: { id: second.id } })
    const res = await call('patch', '/users/me', second).send({ firstName: 'Пётр', phone: '12345', email: second.email, companyName: 'Агентство 2' })
    expect(res.status).toBe(200)
    expect(res.body.phone).toBe('12345')
    const empty = await call('patch', '/users/me', admin).send({ firstName: 'Админ', phone: '', email: admin.email, companyName: '' })
    expect(empty.status).toBe(200)
    expect(empty.body.phone).toBeNull()
    expect((await call('patch', '/users/me', second).send({ phone: '777' })).status).toBe(400)
    const changed = await call('patch', '/users/me', second).send({ phone: '8 900 123-45-67' })
    expect(changed.body.phone).toBe('+7 900 123-45-67')
  })

  test('agents keep a company and individuals have none', async () => {
    expect((await call('patch', '/users/me', agent).send({ companyName: '' })).status).toBe(400)
    await User.update({ companyName: 'Старое' }, { where: { id: individual.id } })
    const res = await call('patch', '/users/me', individual).send({ companyName: 'Старое', firstName: 'Иван' })
    expect(res.status).toBe(200)
    expect(res.body.companyName).toBeNull()
  })

  test('marketing consent requires a boolean decision', async () => {
    expect((await call('patch', '/users/me/consents/marketing', agent).send({ accepted: 'yes' })).status).toBe(400)
    const res = await call('patch', '/users/me/consents/marketing', agent).send({ accepted: true, documentVersion: '2026-10' })
    expect(res.body).toMatchObject({ marketingConsentGiven: true, marketingConsentVersion: '2026-10' })
  })
})

describe('background jobs', () => {
  test('a reminder cancelled for a start time is revived when the event returns to it', async () => {
    const startAt = new Date(Date.now() + 30 * 60000)
    const event = await Event.create({ title: 'Вебинар', startAt, createdBy: admin.id })
    await EventRegistration.create({ eventId: event.id, agentId: agent.id, status: 'approved' })
    await EventReminder.create({ eventId: event.id, agentId: agent.id, startAt, minutesBefore: 60, dueAt: new Date(startAt.getTime() - 3600000), status: 'cancelled' })
    const result = await sendEventReminders()
    expect(result.created).toBe(1)
    expect((await EventReminder.findOne({ where: { eventId: event.id } })).status).toBe('delivered')
  })

  test('expired and revoked sessions are removed after a grace day', async () => {
    const day = 86400000
    const stale = await AuthSession.create({ userId: agent.id, refreshTokenHash: hashToken('stale'), expiresAt: new Date(Date.now() - 2 * day) })
    const revoked = await AuthSession.create({ userId: agent.id, refreshTokenHash: hashToken('revoked'), expiresAt: new Date(Date.now() + day), revokedAt: new Date(Date.now() - 2 * day) })
    const recent = await AuthSession.create({ userId: agent.id, refreshTokenHash: hashToken('recent'), expiresAt: new Date(Date.now() - 1000) })
    await cleanupAuthSessions()
    expect(await AuthSession.findByPk(stale.id)).toBeNull()
    expect(await AuthSession.findByPk(revoked.id)).toBeNull()
    expect(await AuthSession.findByPk(recent.id)).not.toBeNull()
  })
})
