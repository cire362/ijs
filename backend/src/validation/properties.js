const Joi = require('joi')

const createPropertySchema = Joi.object({
  title: Joi.string().trim().max(255).required().messages({
    'any.required': 'Укажите название'
  }),
  region: Joi.string().trim().max(200).required().messages({
    'any.required': 'Укажите регион'
  }),
  city: Joi.string().trim().max(200).required().messages({
    'any.required': 'Укажите город'
  }),
  street: Joi.string().trim().max(255).allow(null, ''),
  plotNumber: Joi.string().trim().max(200).allow(null, ''),
  landArea: Joi.number().min(0).empty('').allow(null),
  houseArea: Joi.number().min(0).empty('').allow(null),
  floors: Joi.number().integer().min(1).max(1000).empty('').allow(null),
  rooms: Joi.number().integer().min(0).max(1000).empty('').allow(null),
  finishingType: Joi.string().trim().max(200).allow(null, ''),
  contractType: Joi.string().trim().max(200).allow(null, ''),
  constructionType: Joi.string().trim().max(200).allow(null, ''),
  readinessType: Joi.string().trim().max(200).allow(null, ''),
  registration: Joi.string().trim().max(200).allow(null, ''),
  saleStatus: Joi.string()
    .valid('available', 'reserved', 'sold')
    .empty(Joi.valid(null, '')),
  buildStage: Joi.string().trim().max(200).allow(null, ''), // stage
  price: Joi.number().min(0).max(999999999999.99).precision(2).empty('').allow(null),
  description: Joi.string().max(20000).allow(null, ''),
  developerId: Joi.number().integer().min(1).max(2147483647).empty('').allow(null) // For admin
})

// For patch/update, usually fields are optional
const updatePropertySchema = convertToOptional(createPropertySchema).min(1)

function convertToOptional (schema) {
  return schema.fork(Object.keys(schema.describe().keys), (schema) =>
    schema.optional()
  )
}

module.exports = {
  createPropertySchema,
  updatePropertySchema
}
