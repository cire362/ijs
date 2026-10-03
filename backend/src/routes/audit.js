const router = require('express').Router()
const Joi = require('joi')
const { authenticate, allowRoles } = require('../middleware/auth')
const validate = require('../middleware/validate')
const asyncHandler = require('../utils/asyncHandler')
const { AuditLog } = require('../models')

router.get('/', authenticate, allowRoles('admin'), validate(Joi.object({
  entityType: Joi.string().valid('property', 'tariff_rate', 'application', 'user'),
  entityId: Joi.number().integer().min(1).max(2147483647),
  page: Joi.number().integer().min(1).max(100000).default(1),
  limit: Joi.number().integer().min(1).max(100).default(50)
}), 'query'), asyncHandler(async (req, res) => {
  const { entityType, entityId, page, limit } = req.query
  const { rows, count } = await AuditLog.findAndCountAll({
    where: { ...(entityType ? { entityType } : {}), ...(entityId ? { entityId } : {}) },
    order: [['id', 'DESC']],
    limit,
    offset: (page - 1) * limit
  })
  res.json({ items: rows, total: count, page, limit })
}))

module.exports = router
