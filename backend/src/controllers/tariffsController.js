const tariffsService = require('../services/tariffsService')
const { Property } = require('../models')

async function getTariffView (req, res) {
  const result = await tariffsService.getTariffView({
    category: req.query.category,
    includeInactive: false,
    includeUnapprovedDevelopers: false
  })
  res.json(result)
}

async function getTariffAdminView (req, res) {
  const includeInactive = req.query.includeInactive !== false
  const result = await tariffsService.getTariffView({
    category: req.query.category,
    includeInactive,
    includeUnapprovedDevelopers: true
  })
  res.json(result)
}
async function putRate (req, res) {
  const propertyId = parseInt(req.params.propertyId, 10)
  const category = req.params.category

  if (!Number.isFinite(propertyId)) { return res.status(400).json({ error: 'Некорректный ID' }) }
  if (!tariffsService.CATEGORIES.includes(category)) {
    return res.status(400).json({ error: 'Некорректная категория' })
  }

  const prop = await Property.findByPk(propertyId)
  if (!prop) return res.sendStatus(404)

  const rate = await tariffsService.upsertRate({
    propertyId,
    category,
    commissionFrom: req.body.commissionFrom,
    commissionTo: req.body.commissionTo,
    notes: req.body.notes,
    isActive: req.body.isActive
  })

  res.json(rate)
}

module.exports = {
  getTariffView,
  getTariffAdminView,
  putRate
}
