const request = require('supertest')

const { syncAndTruncateExcept } = require('./testDb')

async function buildIsolatedAppAndDb () {
  jest.resetModules()

  const app = require('../src/app')
  const { sequelize } = require('../src/db')
  const { AddressSuggestion } = require('../src/models')

  await syncAndTruncateExcept(sequelize, {
    keepTables: ['address_suggestions']
  })
  return { app, sequelize, AddressSuggestion }
}

describe('address suggest', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    global.fetch = jest.fn()
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  test('returns [] for short query', async () => {
    const { app, sequelize } = await buildIsolatedAppAndDb()
    try {
      const res = await request(app).get('/address/suggest?kind=city&q=a')
      expect(res.status).toBe(200)
      expect(res.body).toEqual([])
      expect(global.fetch).not.toHaveBeenCalled()
    } finally {
      await sequelize.close()
    }
  })

  test('maps city suggestions', async () => {
    const { app, sequelize } = await buildIsolatedAppAndDb()
    try {
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => [
          { address: { city: 'Екатеринбург' } },
          { address: { town: 'Екатеринбург' } }
        ]
      })

      const res = await request(app).get(
        '/address/suggest?kind=city&q=__jest_city_query__&region=Свердловская%20область'
      )
      expect(res.status).toBe(200)
      expect(Array.isArray(res.body)).toBe(true)
      expect(res.body.length).toBe(1)
      expect(res.body[0]).toHaveProperty('label', 'Екатеринбург')
      expect(global.fetch).toHaveBeenCalledTimes(1)
    } finally {
      await sequelize.close()
    }
  })

  test('maps street suggestions', async () => {
    const { app, sequelize } = await buildIsolatedAppAndDb()
    try {
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => [
          { address: { road: 'улица Ленина' } },
          { address: { road: 'улица Ленина' } }
        ]
      })

      const res = await request(app).get(
        '/address/suggest?kind=street&q=__jest_street_query__&city=Екатеринбург'
      )
      expect(res.status).toBe(200)
      expect(Array.isArray(res.body)).toBe(true)
      expect(res.body.length).toBe(1)
      expect(res.body[0]).toHaveProperty('label', 'улица Ленина')
      expect(global.fetch).toHaveBeenCalledTimes(1)
    } finally {
      await sequelize.close()
    }
  })

  test('returns local DB suggestions without calling upstream', async () => {
    const { app, sequelize, AddressSuggestion } = await buildIsolatedAppAndDb()
    try {
      await AddressSuggestion.create({
        kind: 'city',
        label: 'jestcity Екатеринбург',
        region: 'Свердловская область'
      })
      await AddressSuggestion.create({
        kind: 'city',
        label: 'jestcity Екатериновка',
        region: 'Свердловская область'
      })

      const res = await request(app).get(
        '/address/suggest?kind=city&q=jestcity&region=Свердловская%20область'
      )
      expect(res.status).toBe(200)
      expect(res.body.length).toBeGreaterThanOrEqual(2)
      expect(res.body[0]).toHaveProperty('label')
      expect(global.fetch).not.toHaveBeenCalled()
    } finally {
      await sequelize.close()
    }
  })

  test('returns [] on upstream error', async () => {
    const { app, sequelize } = await buildIsolatedAppAndDb()
    try {
      global.fetch.mockResolvedValue({ ok: false })

      const res = await request(app).get(
        '/address/suggest?kind=city&q=__jest_upstream_error__'
      )
      expect(res.status).toBe(200)
      expect(res.body).toEqual([])
    } finally {
      await sequelize.close()
    }
  })
})
