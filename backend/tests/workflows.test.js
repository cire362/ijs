const request = require('supertest')
const bcrypt = require('bcryptjs')
const app = require('../src/app')
const { sequelize } = require('../src/db')
const {
  User, Property, Application, StatusHistory, Notification,
  TariffPropertyRate, EventRegistration, Event
} = require('../src/models')
const { syncAndTruncateExcept } = require('./testDb')
const { expireSentApplications } = require('../src/jobs/applicationExpiry')
const { setIO } = require('../src/socket')

let agent, individual, developer, property
let agentToken, secondToken, individualToken, developerToken, adminToken

function authorized (method, path, token = agentToken) {
  return request(app)[method](path).set('Authorization', `Bearer ${token}`)
}

async function sendApplication (phone = '+79991112233', token = agentToken, extra = {}) {
  return authorized('post', '/applications', token).send({
    propertyId: property.id, clientFullName: 'Тестовый Клиент', clientPhone: phone, ...extra
  })
}

async function createEvent (capacity = 1, extra = {}) {
  const res = await authorized('post', '/events', adminToken).send({
    title: 'Тестовое мероприятие',
    startAt: new Date(Date.now() + 86400000).toISOString(),
    capacity,
    ...extra
  })
  expect(res.status).toBe(201)
  return res.body
}

beforeAll(async () => {
  await syncAndTruncateExcept(sequelize)
  const passwordHash = await bcrypt.hash('test_password', 10)
  const users = await User.bulkCreate([
    { email: 'workflow-agent@test.com', role: 'agent' },
    { email: 'workflow-second@test.com', role: 'agent' },
    { email: 'workflow-person@test.com', role: 'individual', phone: '+7 999 333-44-55' },
    { email: 'workflow-dev@test.com', role: 'developer', developerApproved: true },
    { email: 'workflow-admin@test.com', role: 'admin' }
  ].map((u) => ({ firstName: 'Тест', lastName: 'Тестовый', passwordHash, ...u })))
  ;[agent, , individual, developer] = users
  const tokens = []
  for (const user of users) {
    const res = await request(app).post('/auth/login').send({ email: user.email, password: 'test_password' })
    expect(res.status).toBe(200)
    tokens.push(res.body.token)
  }
  ;[agentToken, secondToken, individualToken, developerToken, adminToken] = tokens
})

beforeEach(async () => {
  property = await Property.create({
    title: 'Тестовый дом',
    region: 'Свердловская область',
    city: 'Екатеринбург',
    developerId: developer.id,
    price: 10000000
  })
})

afterEach(() => setIO(null))
afterAll(async () => sequelize.close())

test('deadline endpoint extends from the existing deadline by the requested number of days', async () => {
  const created = await sendApplication()
  expect(created.status).toBe(201)
  const res = await authorized('patch', `/applications/${created.body.id}/extend`, developerToken).send({ days: 3 })
  expect(res.status).toBe(200)
  expect(new Date(res.body.expiresAt).getTime() - new Date(created.body.expiresAt).getTime()).toBe(3 * 86400000)
})

test('concurrent duplicate submissions create one application', async () => {
  const responses = await Promise.all([sendApplication(), sendApplication()])
  expect(responses.map((r) => r.status).sort()).toEqual([201, 409])
  expect(await Application.count({ where: { propertyId: property.id } })).toBe(1)
})

test('concurrent confirmations cannot reserve one property for two clients', async () => {
  const first = await sendApplication()
  const second = await sendApplication('+79992223344', secondToken)
  const responses = await Promise.all([first, second].map((res) =>
    authorized('patch', `/applications/${res.body.id}/status`, developerToken).send({ status: 'confirmed' })
  ))
  expect(responses.map((r) => r.status).sort()).toEqual([200, 409])
  expect(await Application.count({ where: { propertyId: property.id, status: 'confirmed' } })).toBe(1)
  expect((await property.reload()).saleStatus).toBe('reserved')
})

test('repeated status update is idempotent and moving backwards is rejected', async () => {
  const created = await sendApplication()
  const url = `/applications/${created.body.id}/status`
  expect((await authorized('patch', url, developerToken).send({ status: 'confirmed' })).status).toBe(200)
  const count = await Notification.count({ where: { userId: agent.id } })
  expect((await authorized('patch', url, developerToken).send({ status: 'confirmed' })).status).toBe(200)
  expect(await Notification.count({ where: { userId: agent.id } })).toBe(count)
  expect(await StatusHistory.count({ where: { applicationId: created.body.id, status: 'confirmed' } })).toBe(1)
  expect((await authorized('patch', url, developerToken).send({ status: 'sent' })).status).toBe(400)
})

test('completion sells the object and closes competing pending applications', async () => {
  const first = await sendApplication()
  const second = await sendApplication('+79992223344', secondToken)
  const completed = await authorized('patch', `/applications/${first.body.id}/status`, developerToken).send({ status: 'done' })
  expect(completed.status).toBe(200)
  expect((await property.reload()).saleStatus).toBe('sold')
  expect((await Application.findByPk(second.body.id)).status).toBe('rejected')
  expect((await authorized('patch', `/applications/${first.body.id}/status`, developerToken).send({ status: 'rejected' })).status).toBe(409)
  expect((await authorized('patch', `/applications/${second.body.id}/status`, developerToken).send({ status: 'confirmed' })).status).toBe(409)
})

test('rejecting a confirmed application releases its reservation', async () => {
  const created = await sendApplication()
  const url = `/applications/${created.body.id}/status`
  await authorized('patch', url, developerToken).send({ status: 'confirmed' })
  const res = await authorized('patch', url, developerToken).send({ status: 'rejected' })
  expect(res.status).toBe(200)
  expect((await property.reload()).saleStatus).toBe('available')
})

test('an elapsed deadline is enforced before the scheduled job runs', async () => {
  const created = await sendApplication()
  await Application.update({ expiresAt: new Date(Date.now() - 1000) }, { where: { id: created.body.id } })
  const res = await authorized('patch', `/applications/${created.body.id}/status`, developerToken).send({ status: 'confirmed' })
  expect(res.status).toBe(409)
  const application = await Application.findByPk(created.body.id)
  expect(application.status).toBe('expired')
  expect(application.expiresAt).toBeNull()
  expect((await property.reload()).saleStatus).toBe('available')
})

test('concurrent expiry workers create one history entry and one notification', async () => {
  const created = await sendApplication()
  await Application.update({ expiresAt: new Date(Date.now() - 1000) }, { where: { id: created.body.id } })
  const results = await Promise.all([expireSentApplications(), expireSentApplications()])
  expect(results.reduce((sum, result) => sum + result.processed, 0)).toBe(1)
  expect(await StatusHistory.count({ where: { applicationId: created.body.id, status: 'expired' } })).toBe(1)
  const notes = await Notification.findAll({ where: { userId: agent.id, type: 'application_status' } })
  expect(notes.filter((n) => n.meta.applicationId === created.body.id && n.meta.status === 'expired')).toHaveLength(1)
})

test('commission is computed by the server and remains fixed after tariff or price changes', async () => {
  const rate = await TariffPropertyRate.create({ propertyId: property.id, category: 'apartments', commissionFrom: 3 })
  const created = await sendApplication(undefined, undefined, { commissionAmount: 1 })
  expect(Number(created.body.commissionAmount)).toBe(300000)
  await rate.update({ commissionFrom: 8 })
  await property.update({ price: 20000000 })
  const list = await authorized('get', '/applications/mine')
  expect(Number(list.body.find((a) => a.id === created.body.id).commissionAmount)).toBe(300000)
})

test('client-provided commission is ignored when no tariff exists', async () => {
  const created = await sendApplication(undefined, undefined, { commissionAmount: 9999999 })
  expect(created.status).toBe(201)
  expect(created.body.commissionAmount).toBeNull()
})

test('an individual application uses their own profile rather than supplied client data', async () => {
  const created = await sendApplication('+79990000000', individualToken)
  expect(created.status).toBe(201)
  expect(created.body.clientPhone).toBe(individual.phone)
  expect(created.body.clientFullName).toBe(individual.fullName)
})

test('a different developer cannot change or extend an application', async () => {
  const created = await sendApplication()
  const other = await User.create({ email: 'other-dev@test.com', role: 'developer', developerApproved: true, passwordHash: developer.passwordHash })
  const login = await request(app).post('/auth/login').send({ email: other.email, password: 'test_password' })
  expect((await authorized('patch', `/applications/${created.body.id}/status`, login.body.token).send({ status: 'confirmed' })).status).toBe(403)
  expect((await authorized('patch', `/applications/${created.body.id}/extend`, login.body.token).send({ days: 7 })).status).toBe(403)
})

test('capacity sent by the existing frontend is saved, and legacy maxParticipants is accepted', async () => {
  const event = await createEvent(2)
  expect(event.capacity).toBe(2)
  const legacy = await createEvent(undefined, { maxParticipants: 3, capacity: undefined })
  expect(legacy.capacity).toBe(3)
  const unlimited = await createEvent('')
  expect(unlimited.capacity).toBeNull()
})

test('concurrent registrations cannot exceed event capacity', async () => {
  const event = await createEvent(1)
  const responses = await Promise.all([agentToken, secondToken].map((token) =>
    authorized('post', `/events/${event.id}/register`, token)
  ))
  expect(responses.map((r) => r.status).sort()).toEqual([201, 409])
  expect(await EventRegistration.count({ where: { eventId: event.id } })).toBe(1)
})

test('a rejected registration releases a place, and cannot be approved above capacity', async () => {
  const event = await createEvent(1)
  const first = await authorized('post', `/events/${event.id}/register`)
  await authorized('patch', `/events/registrations/${first.body.id}`, adminToken).send({ status: 'rejected' })
  expect((await authorized('post', `/events/${event.id}/register`, secondToken)).status).toBe(201)
  expect((await authorized('patch', `/events/registrations/${first.body.id}`, adminToken).send({ status: 'approved' })).status).toBe(409)
})

test('events cannot be created in the past, and registration is closed after the event starts', async () => {
  const past = await authorized('post', '/events', adminToken).send({ title: 'Прошлое', startAt: new Date(Date.now() - 10000).toISOString() })
  expect(past.status).toBe(400)
  const event = await createEvent(2)
  await Event.update({ startAt: new Date(Date.now() - 10000) }, { where: { id: event.id } })
  expect((await authorized('post', `/events/${event.id}/register`)).status).toBe(409)
})

test('notifications are published only after a successful commit', async () => {
  const emit = jest.fn()
  setIO({ to: () => ({ emit }) })
  await expect(sequelize.transaction(async (transaction) => {
    await Notification.create({ userId: agent.id, text: 'rolled back' }, { transaction })
    expect(emit).not.toHaveBeenCalled()
    throw new Error('rollback')
  })).rejects.toThrow('rollback')
  expect(emit).not.toHaveBeenCalled()
  await sequelize.transaction(async (transaction) => {
    await Notification.bulkCreate([{ userId: agent.id, text: 'committed' }], { transaction })
    expect(emit).not.toHaveBeenCalled()
  })
  expect(emit).toHaveBeenCalledTimes(1)
  expect(emit.mock.calls[0][1].text).toBe('committed')
})

test('invalid identifiers and filters return a client error before touching the database', async () => {
  for (const id of ['0', '-1', '1.2', '1abc', '2147483648']) {
    expect((await request(app).get(`/properties/${id}`)).status).toBe(400)
  }
  expect((await request(app).get('/properties?priceMin=abc')).status).toBe(400)
  expect((await request(app).get('/properties?priceMin=10&priceMax=1')).status).toBe(400)
  expect((await authorized('get', '/applications/incoming?developerId=1abc', adminToken)).status).toBe(400)
  expect((await request(app).get('/events?page=1.5')).status).toBe(400)
})

test('property creation accepts optional empty numeric fields but rejects negative prices', async () => {
  const payload = { title: 'Дом', region: 'Область', city: 'Город', rooms: '', floors: '', landArea: '', price: '', saleStatus: '' }
  const created = await authorized('post', '/properties', developerToken).send(payload)
  expect(created.status).toBe(201)
  expect(created.body.saleStatus).toBe('available')
  expect((await authorized('post', '/properties', developerToken).send({ ...payload, price: -1 })).status).toBe(400)
})
