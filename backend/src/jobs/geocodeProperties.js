const { Op } = require('sequelize')
const { Property } = require('../models')
const { geocode, hasProvider } = require('../services/addressService')
const logger = require('../utils/logger')

function addressOf (property) {
  return [property.region, property.city, property.street].filter(Boolean).join(', ')
}

// Fills coordinates of one object from its address. A failed lookup is not retried until the address changes.
async function geocodeProperty (id) {
  const property = await Property.findByPk(id)
  if (!property || property.latitude != null) return false
  const point = await geocode(addressOf(property))
  // The address may have changed while the provider answered; only the same address gets the point.
  const [updated] = await Property.update(
    point ? { latitude: point.lat, longitude: point.lng, geoPrecision: point.precision, geocodedAt: new Date() } : { geocodedAt: new Date() },
    { where: { id, latitude: null, region: property.region, city: property.city, street: property.street } }
  )
  return Boolean(point && updated)
}

function geocodeInBackground (id) {
  if (!hasProvider()) return
  geocodeProperty(id).catch((error) => logger.warn('property_geocode_failed', { propertyId: id, error: error.message }))
}

// Older objects and failed lookups after an address change are processed in small batches to respect the quota.
async function geocodeMissingProperties ({ limit = 25 } = {}) {
  if (!hasProvider()) return { skipped: 'no_provider' }
  const pending = await Property.findAll({
    where: { latitude: null, geocodedAt: null, region: { [Op.ne]: null } },
    attributes: ['id'],
    order: [['id', 'ASC']],
    limit
  })
  let located = 0
  for (const { id } of pending) if (await geocodeProperty(id)) located++
  return { checked: pending.length, located }
}

module.exports = { geocodeProperty, geocodeInBackground, geocodeMissingProperties }
