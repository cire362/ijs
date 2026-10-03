const { sequelize } = require('../db')
const { User, Property, TariffPropertyRate, AuditLog } = require('../models')

const CATEGORIES = ['apartments', 'commercial', 'parking', 'storage']

function ensureIn (value, allowed, fallback) {
  if (allowed.includes(value)) return value
  return fallback
}

async function getTariffView ({
  category,
  includeInactive = false,
  includeUnapprovedDevelopers = false
}) {
  const normalizedCategory = ensureIn(
    String(category || ''),
    CATEGORIES,
    'apartments'
  )

  const userWhere = { role: 'developer', deletedAt: null }
  if (!includeUnapprovedDevelopers) userWhere.developerApproved = true

  const rateWhere = { category: normalizedCategory }
  if (!includeInactive) rateWhere.isActive = true

  const developers = await User.findAll({
    where: userWhere,
    order: [
      ['companyName', 'ASC'],
      ['lastName', 'ASC'],
      ['firstName', 'ASC'],
      ['id', 'ASC']
    ],
    include: [
      {
        model: Property,
        as: 'properties',
        required: false,
        include: [
          {
            model: TariffPropertyRate,
            as: 'tariffRates',
            required: false,
            where: rateWhere
          }
        ]
      }
    ]
  })

  const payload = developers.map((dev) => {
    const properties = Array.isArray(dev.properties) ? dev.properties : []
    const displayName = String(
      dev.companyName || dev.fullName || dev.name || dev.email || ''
    ).trim()
    return {
      id: dev.id,
      type: 'developer',
      name: displayName,
      isActive: true,
      complexes: properties
        .sort((a, b) => String(a.title).localeCompare(String(b.title)))
        .map((p) => {
          const rates = Array.isArray(p.tariffRates) ? p.tariffRates : []
          const rate = rates[0] || null
          return {
            id: p.id,
            name: p.title,
            isActive: true,
            rate: rate
              ? {
                  id: rate.id,
                  category: rate.category,
                  commissionFrom: rate.commissionFrom,
                  commissionTo: rate.commissionTo,
                  notes: rate.notes,
                  isActive: rate.isActive
                }
              : null
          }
        })
    }
  })

  return {
    type: 'developer',
    category: normalizedCategory,
    counterparties: payload
  }
}

module.exports = {
  CATEGORIES,
  ensureIn,
  getTariffView,
  async upsertRate ({ propertyId, category, commissionFrom, commissionTo, notes, isActive }, actorId = null) {
    return sequelize.transaction(async (transaction) => {
      const property = await Property.findByPk(propertyId, { transaction, lock: transaction.LOCK.UPDATE })
      if (!property) throw { status: 404, message: 'Объект не найден' }
      let rate = await TariffPropertyRate.findOne({ where: { propertyId, category }, transaction, lock: transaction.LOCK.UPDATE })
      const fields = ['commissionFrom', 'commissionTo', 'notes', 'isActive']
      const before = rate ? Object.fromEntries(fields.map((key) => [key, rate[key]])) : null
      const values = {
        commissionFrom,
        commissionTo,
        notes: notes ?? null,
        isActive: isActive ?? rate?.isActive ?? true
      }
      if (rate) await rate.update(values, { transaction })
      else rate = await TariffPropertyRate.create({ propertyId, category, ...values }, { transaction })
      await AuditLog.create({
        entityType: 'tariff_rate',
        entityId: rate.id,
        actorId,
        action: before ? 'rate_changed' : 'rate_created',
        before,
        after: { propertyId, category, ...Object.fromEntries(fields.map((key) => [key, rate[key]])) }
      }, { transaction })
      return rate
    })
  }
}
