const { Op, fn, col } = require('sequelize')
const { Property } = require('../models')
const logger = require('../utils/logger')

// DaData suggestions API: Russian addresses down to the house with coordinates.
// Without DADATA_API_KEY (or when DaData fails) addresses of existing objects are suggested.
const DADATA_URL = 'https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/address'
const TIMEOUT_MS = 3000
const CACHE_TTL_MS = 10 * 60 * 1000
const CACHE_MAX = 2000
const KINDS = ['address', 'region', 'city', 'street']

const cache = new Map()

function cacheGet (key) {
  const hit = cache.get(key)
  if (!hit) return null
  if (hit.expiresAt < Date.now()) { cache.delete(key); return null }
  return hit.value
}

function cacheSet (key, value) {
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value)
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS })
}

function hasProvider () {
  return Boolean(process.env.DADATA_API_KEY)
}

// DaData filters by bare names: "Свердловская обл" -> "Свердловская", "г Сочи" -> "Сочи".
const TYPE_WORDS = new Set(['обл', 'область', 'край', 'респ', 'республика', 'г', 'город', 'ао', 'аобл', 'автономный', 'округ', 'автономная'])

function bareName (value) {
  // Word boundaries (\b) do not work with Cyrillic, so the name is filtered word by word.
  return String(value || '')
    .split(/\s+/)
    .filter((word) => word && !TYPE_WORDS.has(word.toLowerCase().replace(/\.$/, '')))
    .join(' ')
}

function number (value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function toItem (kind, suggestion) {
  const d = suggestion.data || {}
  const city = d.city || d.settlement_with_type || d.area_with_type || null
  const house = [d.house_type && d.house ? `${d.house_type} ${d.house}` : null, d.block_type && d.block ? `${d.block_type} ${d.block}` : null].filter(Boolean).join(' ')
  const street = [d.street_with_type, house].filter(Boolean).join(', ') || null
  const label = {
    region: d.region_with_type,
    city: d.city_with_type || d.settlement_with_type,
    street: d.street_with_type,
    address: suggestion.value
  }[kind] || suggestion.value
  return {
    label,
    value: suggestion.value,
    region: d.region_with_type || null,
    city,
    street,
    house: d.house || null,
    lat: number(d.geo_lat),
    lng: number(d.geo_lon),
    // qc_geo: 0 exact house, 1 nearest house, 2 street, 3 settlement, 4 city, 5 unknown.
    precision: number(d.qc_geo)
  }
}

async function requestDadata (body) {
  const response = await fetch(DADATA_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Token ${process.env.DADATA_API_KEY}`
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS)
  })
  if (!response.ok) throw Object.assign(new Error(`DaData responded ${response.status}`), { status: response.status })
  const payload = await response.json()
  return Array.isArray(payload?.suggestions) ? payload.suggestions : []
}

function dadataBody (kind, query, { region, city, count }) {
  const body = { query, count, language: 'ru' }
  if (kind === 'region') Object.assign(body, { from_bound: { value: 'region' }, to_bound: { value: 'region' } })
  if (kind === 'city') Object.assign(body, { from_bound: { value: 'city' }, to_bound: { value: 'settlement' } })
  if (kind === 'street') Object.assign(body, { from_bound: { value: 'street' }, to_bound: { value: 'street' } })
  const location = {}
  if (region && kind !== 'region') location.region = bareName(region)
  if (city && kind === 'street') location.city = bareName(city)
  if (Object.keys(location).length) body.locations = [location]
  return body
}

// Without a provider, addresses already entered for objects are suggested.
async function searchLocal (kind, query, { region, city, count }) {
  const like = { [Op.iLike]: `%${query}%` }
  const where = []
  if (kind === 'region') where.push({ region: like })
  else if (kind === 'city') where.push({ city: like })
  else if (kind === 'street') where.push({ street: like })
  else where.push({ [Op.or]: [{ region: like }, { city: like }, { street: like }] })
  if (region && kind !== 'region') where.push({ region })
  if (city && kind === 'street') where.push({ city })
  const attributes = kind === 'region' ? ['region'] : kind === 'city' ? ['region', 'city'] : ['region', 'city', 'street']
  const rows = await Property.findAll({
    where: { [Op.and]: where },
    attributes: [...attributes, [fn('max', col('latitude')), 'lat'], [fn('max', col('longitude')), 'lng'], [fn('min', col('geo_precision')), 'precision']],
    group: attributes,
    order: attributes.map((key) => [key, 'ASC']),
    limit: count,
    raw: true
  })
  return rows.map((row) => {
    const value = attributes.map((key) => row[key]).filter(Boolean).join(', ')
    const exact = kind !== 'region' && kind !== 'city' && row.street && row.precision != null && row.precision <= 1
    return {
      label: kind === 'region' ? row.region : kind === 'city' ? row.city : kind === 'street' ? row.street : value,
      value,
      region: row.region || null,
      city: row.city || null,
      street: row.street || null,
      house: null,
      lat: exact ? Number(row.lat) : null,
      lng: exact ? Number(row.lng) : null,
      precision: exact ? row.precision : null
    }
  }).filter((item) => item.label)
}

async function suggest ({ kind = 'address', query, region, city, count = 7 }) {
  const q = String(query || '').replace(/\s+/g, ' ').trim().slice(0, 300)
  if (!KINDS.includes(kind) || q.length < 2) return { items: [], source: 'none' }
  if (!hasProvider()) return { items: await searchLocal(kind, q, { region, city, count }), source: 'local' }

  const key = JSON.stringify([kind, q.toLowerCase(), region || '', city || '', count])
  const cached = cacheGet(key)
  if (cached) return { items: cached, source: 'dadata' }
  try {
    let suggestions = await requestDadata(dadataBody(kind, q, { region, city, count }))
    // A region typed differently from DaData's naming must not hide every result.
    if (!suggestions.length && (region || city)) suggestions = await requestDadata(dadataBody(kind, q, { count }))
    const items = suggestions.map((s) => toItem(kind, s)).filter((item) => item.label)
    cacheSet(key, items)
    return { items, source: 'dadata' }
  } catch (error) {
    logger.warn('address_provider_failed', { error: error.message, status: error.status })
    return { items: await searchLocal(kind, q, { region, city, count }), source: 'local' }
  }
}

// Coordinates for a typed address: the best DaData match, if precise enough (street or better).
async function geocode (address) {
  if (!hasProvider()) return null
  const q = String(address || '').trim()
  if (q.length < 5) return null
  try {
    const [best] = await requestDadata({ query: q, count: 1, language: 'ru' })
    if (!best) return null
    const item = toItem('address', best)
    // Settlement precision is still useful for rural plots; the precision is kept with the point.
    if (item.lat == null || item.lng == null || (item.precision != null && item.precision > 3)) return null
    return { lat: item.lat, lng: item.lng, precision: item.precision ?? 3 }
  } catch (error) {
    logger.warn('address_geocode_failed', { error: error.message, status: error.status })
    return null
  }
}

module.exports = { suggest, geocode, hasProvider, bareName, clearCache: () => cache.clear() }
