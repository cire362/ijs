const request = require('supertest')
const jwt = require('jsonwebtoken')
const app = require('../src/app')
const { sequelize } = require('../src/db')
const { User, AuthSession, Property } = require('../src/models')
const { hashToken } = require('../src/utils/authTokens')
const { geocodeMissingProperties, geocodeProperty } = require('../src/jobs/geocodeProperties')
const { clearCache } = require('../src/services/addressService')
const { syncAndTruncateExcept } = require('./testDb')

let agent, developer, otherDeveloper
const tokens = new Map()
const originalFetch = global.fetch
const originalKey = process.env.DADATA_API_KEY

function call (method, url, user) {
  return request(app)[method](url).set('Authorization', `Bearer ${tokens.get(user.id)}`)
}
function ids (res) { return res.body.items.map((item) => item.title).sort() }
const point = (lat, lon, qc = '0') => ({ ok: true, json: async () => ({ suggestions: [{ value: 'адрес', data: { geo_lat: String(lat), geo_lon: String(lon), qc_geo: qc } }] }) })

beforeAll(async () => {
  await syncAndTruncateExcept(sequelize)
  ;[agent, developer, otherDeveloper] = await User.bulkCreate([
    { role: 'agent', email: 'catalog-agent@test.com' },
    { role: 'developer', email: 'catalog-dev@test.com', companyName: 'СЗ Берёзы', developerApproved: true },
    { role: 'developer', email: 'catalog-dev2@test.com', companyName: 'Альфа Дом', developerApproved: true }
  ].map((user) => ({ passwordHash: 'fixture', ...user })))
  for (const user of [agent, developer, otherDeveloper]) {
    const session = await AuthSession.create({ userId: user.id, refreshTokenHash: hashToken(`catalog-${user.id}`), expiresAt: new Date(Date.now() + 3600000) })
    tokens.set(user.id, jwt.sign({ sub: user.id, sid: session.id }, process.env.JWT_SECRET, { expiresIn: '1h' }))
  }
  await Property.bulkCreate([
    { title: 'Каменный', region: 'Свердловская обл', city: 'Екатеринбург', developerId: developer.id, price: 9000000, landArea: 10, houseArea: 150, buildStage: 'Коробка', finishingType: 'Чистовая', contractType: 'ДКП', constructionType: 'Кирпич', readinessType: 'Строится', registration: 'ИЖС' },
    { title: 'Каркасный', region: 'Свердловская обл', city: 'Берёзовский', developerId: developer.id, price: 5000000, landArea: 6, houseArea: 90, buildStage: 'Готовый дом', finishingType: 'Без отделки', contractType: 'ДДУ', constructionType: 'Каркас', readinessType: 'Готовый дом', registration: 'СНТ', saleStatus: 'reserved' },
    { title: 'Южный', region: 'Краснодарский край', city: 'Сочи', developerId: otherDeveloper.id, price: 15000000, landArea: 8, houseArea: 200, constructionType: 'Газобетон' }
  ])
})
afterEach(() => {
  global.fetch = originalFetch
  if (originalKey === undefined) delete process.env.DADATA_API_KEY
  else process.env.DADATA_API_KEY = originalKey
  clearCache()
})
afterAll(async () => sequelize.close())

describe('catalog filters', () => {
  test('every characteristic of an object can be filtered on the server together with pagination', async () => {
    const list = (query) => call('get', `/properties?page=1&limit=10&${new URLSearchParams(query)}`, agent)
    expect(ids(await list({ constructionType: 'Кирпич' }))).toEqual(['Каменный'])
    expect(ids(await list({ buildStage: 'Готовый дом', finishingType: 'Без отделки' }))).toEqual(['Каркасный'])
    expect(ids(await list({ contractType: 'ДКП' }))).toEqual(['Каменный'])
    expect(ids(await list({ readinessType: 'Строится' }))).toEqual(['Каменный'])
    expect(ids(await list({ registration: 'СНТ' }))).toEqual(['Каркасный'])
    expect(ids(await list({ landMin: 7, landMax: 9 }))).toEqual(['Южный'])
    expect(ids(await list({ houseMin: 100 }))).toEqual(['Каменный', 'Южный'])
    expect(ids(await list({ developerId: otherDeveloper.id }))).toEqual(['Южный'])
    expect(ids(await list({ q: 'сочи' }))).toEqual(['Южный'])
    expect((await list({ landMin: 9, landMax: 7 })).status).toBe(400)
  })

  test('developers see only their own objects whatever developer filter is sent; guests only objects on sale', async () => {
    const own = await call('get', `/properties?page=1&limit=10&developerId=${otherDeveloper.id}`, developer)
    expect(ids(own)).toEqual(['Каменный', 'Каркасный'])
    const guest = await request(app).get('/properties?page=1&limit=10&status=reserved')
    expect(ids(guest)).toEqual(['Каменный', 'Южный'])
  })

  test('filter dropdowns list regions, cities and developers of the visible catalog', async () => {
    const res = await call('get', '/properties/facets', agent)
    expect(res.status).toBe(200)
    expect(res.body.regions).toEqual([{ value: 'Краснодарский край', count: 1 }, { value: 'Свердловская обл', count: 2 }])
    expect(res.body.cities).toContainEqual({ value: 'Берёзовский', region: 'Свердловская обл', count: 1 })
    expect(res.body.developers.map((dev) => dev.name)).toEqual(['Альфа Дом', 'СЗ Берёзы'])
    const own = await call('get', '/properties/facets', developer)
    expect(own.body.regions).toEqual([{ value: 'Свердловская обл', count: 2 }])
    expect(own.body.developers).toEqual([])
  })
})

describe('object location', () => {
  test('a point picked on the map is stored as exact; an address change without a point clears it', async () => {
    const created = await call('post', '/properties', developer).send({ title: 'С точкой', region: 'Свердловская обл', city: 'Екатеринбург', street: 'ул Ленина, д 5', latitude: 56.8378, longitude: 60.605 })
    expect(created.status).toBe(201)
    expect(created.body).toMatchObject({ latitude: 56.8378, longitude: 60.605, geoPrecision: 0 })
    const moved = await call('patch', `/properties/${created.body.id}`, developer).send({ street: 'ул Мира, д 1' })
    expect(moved.body).toMatchObject({ latitude: null, longitude: null, geocodedAt: null })
    expect((await call('patch', `/properties/${created.body.id}`, developer).send({ latitude: 56.8 })).status).toBe(400)
    expect((await call('patch', `/properties/${created.body.id}`, developer).send({ latitude: 95, longitude: 60 })).status).toBe(400)
  })

  test('objects without a point are geocoded from the address once, imprecise matches are skipped', async () => {
    process.env.DADATA_API_KEY = 'd'.repeat(40)
    await Property.update({ latitude: null, longitude: null, geocodedAt: null }, { where: {} })
    global.fetch = jest.fn()
      .mockResolvedValueOnce(point(56.83, 60.6, '2'))
      .mockResolvedValueOnce(point(56.9, 60.8, '5'))
      .mockResolvedValue(point(43.6, 39.7, '0'))
    const first = await geocodeMissingProperties({ limit: 2 })
    expect(first).toEqual({ checked: 2, located: 1 })
    const located = await Property.findOne({ where: { title: 'Каменный' } })
    expect(located).toMatchObject({ latitude: 56.83, longitude: 60.6, geoPrecision: 2 })
    const skipped = await Property.findOne({ where: { title: 'Каркасный' } })
    expect(skipped.latitude).toBeNull()
    expect(skipped.geocodedAt).not.toBeNull()
    const query = JSON.parse(global.fetch.mock.calls[0][1].body).query
    expect(query).toBe('Свердловская обл, Екатеринбург')
    await geocodeMissingProperties({ limit: 10 })
    expect((await Property.findOne({ where: { title: 'Каркасный' } })).latitude).toBeNull()
  })

  test('without a provider key nothing is geocoded', async () => {
    delete process.env.DADATA_API_KEY
    global.fetch = jest.fn()
    expect(await geocodeMissingProperties()).toEqual({ skipped: 'no_provider' })
    const property = await Property.findOne({ where: { title: 'Южный' } })
    expect(await geocodeProperty(property.id)).toBe(false)
    expect(global.fetch).not.toHaveBeenCalled()
  })
})
