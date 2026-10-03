const request = require('supertest')
const jwt = require('jsonwebtoken')
const app = require('../src/app')
const { sequelize } = require('../src/db')
const { User, AuthSession, Property } = require('../src/models')
const { hashToken } = require('../src/utils/authTokens')
const { clearCache } = require('../src/services/addressService')
const { syncAndTruncateExcept } = require('./testDb')

let token
const originalFetch = global.fetch
const originalKey = process.env.DADATA_API_KEY

const dadataAnswer = {
  suggestions: [{
    value: 'Свердловская обл, г Екатеринбург, ул Ленина, д 5',
    data: {
      region_with_type: 'Свердловская обл',
      city: 'Екатеринбург',
      city_with_type: 'г Екатеринбург',
      street_with_type: 'ул Ленина',
      house_type: 'д',
      house: '5',
      geo_lat: '56.8378',
      geo_lon: '60.6050',
      qc_geo: '0'
    }
  }]
}

function suggest (query) {
  return request(app).get(`/address/suggest?${new URLSearchParams(query)}`).set('Authorization', `Bearer ${token}`)
}

beforeAll(async () => {
  await syncAndTruncateExcept(sequelize)
  const user = await User.create({ role: 'developer', email: 'address-dev@test.com', passwordHash: 'fixture', developerApproved: true })
  const session = await AuthSession.create({ userId: user.id, refreshTokenHash: hashToken('address-dev'), expiresAt: new Date(Date.now() + 3600000) })
  token = jwt.sign({ sub: user.id, sid: session.id }, process.env.JWT_SECRET, { expiresIn: '1h' })
  await Property.bulkCreate([
    { title: 'Дом 1', region: 'Свердловская обл', city: 'Екатеринбург', street: 'ул Ленина, д 5', developerId: user.id, latitude: 56.8378, longitude: 60.605, geoPrecision: 0 },
    { title: 'Дом 2', region: 'Свердловская обл', city: 'Екатеринбург', street: 'ул Мира', developerId: user.id },
    { title: 'Дом 3', region: 'Краснодарский край', city: 'Сочи', street: 'Лесная', developerId: user.id }
  ])
})
beforeEach(() => { global.fetch = jest.fn(); clearCache() })
afterEach(() => {
  global.fetch = originalFetch
  if (originalKey === undefined) delete process.env.DADATA_API_KEY
  else process.env.DADATA_API_KEY = originalKey
})
afterAll(async () => sequelize.close())

test('suggestions require an account and ignore very short queries', async () => {
  expect((await request(app).get('/address/suggest?q=Екат')).status).toBe(401)
  const res = await suggest({ q: 'Е' })
  expect(res.body).toEqual([])
  expect(global.fetch).not.toHaveBeenCalled()
})

test('without a provider key, addresses of existing objects are suggested and nothing leaves the server', async () => {
  delete process.env.DADATA_API_KEY
  const city = await suggest({ q: 'екатер', kind: 'city', region: 'Свердловская обл' })
  expect(city.status).toBe(200)
  expect(city.headers['x-address-source']).toBe('local')
  expect(city.body).toEqual([expect.objectContaining({ label: 'Екатеринбург', city: 'Екатеринбург', region: 'Свердловская обл', lat: null })])
  const full = await suggest({ q: 'ленина' })
  expect(full.body[0]).toMatchObject({ label: 'Свердловская обл, Екатеринбург, ул Ленина, д 5', street: 'ул Ленина, д 5', lat: 56.8378, lng: 60.605, precision: 0 })
  const anywhere = await suggest({ q: 'соч' })
  expect(anywhere.body.map((item) => item.city)).toEqual(['Сочи'])
  expect(global.fetch).not.toHaveBeenCalled()
})

test('DaData suggestions are mapped to object fields with coordinates and cached', async () => {
  process.env.DADATA_API_KEY = 'a'.repeat(40)
  global.fetch.mockResolvedValue({ ok: true, json: async () => dadataAnswer })
  const res = await suggest({ q: 'Екатеринбург Ленина 5' })
  expect(res.headers['x-address-source']).toBe('dadata')
  expect(res.body[0]).toEqual({
    label: 'Свердловская обл, г Екатеринбург, ул Ленина, д 5',
    value: 'Свердловская обл, г Екатеринбург, ул Ленина, д 5',
    region: 'Свердловская обл',
    city: 'Екатеринбург',
    street: 'ул Ленина, д 5',
    house: '5',
    lat: 56.8378,
    lng: 60.605,
    precision: 0
  })
  const [url, init] = global.fetch.mock.calls[0]
  expect(url).toMatch(/suggestions\.dadata\.ru/)
  expect(init.headers.Authorization).toBe(`Token ${'a'.repeat(40)}`)
  await suggest({ q: 'Екатеринбург Ленина 5' })
  expect(global.fetch).toHaveBeenCalledTimes(1)
})

test('city suggestions are bounded and filtered by region name without its type', async () => {
  process.env.DADATA_API_KEY = 'b'.repeat(40)
  global.fetch.mockResolvedValue({ ok: true, json: async () => dadataAnswer })
  const res = await suggest({ q: 'екат', kind: 'city', region: 'Свердловская обл' })
  expect(res.body[0].label).toBe('г Екатеринбург')
  const body = JSON.parse(global.fetch.mock.calls[0][1].body)
  expect(body).toMatchObject({ from_bound: { value: 'city' }, to_bound: { value: 'settlement' }, locations: [{ region: 'Свердловская' }] })
})

test('a provider failure falls back to known addresses', async () => {
  process.env.DADATA_API_KEY = 'c'.repeat(40)
  global.fetch.mockResolvedValue({ ok: false, status: 403, json: async () => ({}) })
  const res = await suggest({ q: 'ленина', kind: 'street', city: 'Екатеринбург' })
  expect(res.status).toBe(200)
  expect(res.headers['x-address-source']).toBe('local')
  expect(res.body[0]).toMatchObject({ street: 'ул Ленина, д 5', city: 'Екатеринбург' })
})
