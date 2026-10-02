const tariffsService = require('../services/tariffsService')

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
  // Params are validated by the route schema; the service returns 404 for a missing property.
  const rate = await tariffsService.upsertRate({
    propertyId: req.params.propertyId,
    category: req.params.category,
    commissionFrom: req.body.commissionFrom,
    commissionTo: req.body.commissionTo,
    notes: req.body.notes,
    isActive: req.body.isActive
  }, req.user.id)

  res.json(rate)
}

module.exports = {
  getTariffView,
  getTariffAdminView,
  putRate
}
