const Joi = require('joi')

const CATEGORIES = ['apartments', 'commercial', 'parking', 'storage']

const getTariffViewQuerySchema = Joi.object({
  category: Joi.string()
    .valid(...CATEGORIES)
    .default('apartments')
})

const getTariffAdminViewQuerySchema = Joi.object({
  category: Joi.string()
    .valid(...CATEGORIES)
    .default('apartments'),
  includeInactive: Joi.boolean().default(true)
})

const putRateBodySchema = Joi.object({
  commissionFrom: Joi.number().min(0).max(100).precision(3).required(),
  commissionTo: Joi.number().min(Joi.ref('commissionFrom')).max(100).precision(3).allow(null),
  notes: Joi.string().max(5000).allow(null, ''),
  isActive: Joi.boolean().allow(null)
})

const putRateParamsSchema = Joi.object({
  propertyId: Joi.number().integer().min(1).max(2147483647).required(),
  category: Joi.string()
    .valid(...CATEGORIES)
    .required()
})

module.exports = {
  getTariffViewQuerySchema,
  getTariffAdminViewQuerySchema,
  putRateBodySchema,
  putRateParamsSchema,
  CATEGORIES
}
