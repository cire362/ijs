const Joi = require("joi");

const CATEGORIES = ["apartments", "commercial", "parking", "storage"];

const getTariffViewQuerySchema = Joi.object({
  category: Joi.string()
    .valid(...CATEGORIES)
    .default("apartments"),
});

const getTariffAdminViewQuerySchema = Joi.object({
  category: Joi.string()
    .valid(...CATEGORIES)
    .default("apartments"),
  includeInactive: Joi.boolean().default(true),
});

const putRateBodySchema = Joi.object({
  commissionFrom: Joi.number().min(0).required(),
  commissionTo: Joi.number().min(0).allow(null),
  notes: Joi.string().allow(null, ""),
  isActive: Joi.boolean().allow(null),
});

const putRateParamsSchema = Joi.object({
  propertyId: Joi.number().integer().min(1).required(),
  category: Joi.string()
    .valid(...CATEGORIES)
    .required(),
});

module.exports = {
  getTariffViewQuerySchema,
  getTariffAdminViewQuerySchema,
  putRateBodySchema,
  putRateParamsSchema,
  CATEGORIES,
};
