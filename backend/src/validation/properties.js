const Joi = require("joi");

const createPropertySchema = Joi.object({
  title: Joi.string().trim().max(500).required().messages({
    "any.required": "Укажите название",
  }),
  region: Joi.string().trim().max(200).required().messages({
    "any.required": "Укажите регион",
  }),
  city: Joi.string().trim().max(200).required().messages({
    "any.required": "Укажите город",
  }),
  street: Joi.string().trim().max(500).allow(null, ""),
  plotNumber: Joi.string().trim().max(200).allow(null, ""),
  landArea: Joi.number().allow(null),
  houseArea: Joi.number().allow(null),
  floors: Joi.number().integer().allow(null),
  rooms: Joi.number().integer().allow(null),
  finishingType: Joi.string().trim().max(200).allow(null, ""),
  contractType: Joi.string().trim().max(200).allow(null, ""),
  constructionType: Joi.string().trim().max(200).allow(null, ""),
  readinessType: Joi.string().trim().max(200).allow(null, ""),
  registration: Joi.string().trim().max(200).allow(null, ""),
  saleStatus: Joi.string()
    .valid("available", "reserved", "sold")
    .allow(null, ""),
  buildStage: Joi.string().trim().max(200).allow(null, ""), // stage
  price: Joi.number().allow(null),
  description: Joi.string().max(20000).allow(null, ""),
  developerId: Joi.number().integer().allow(null), // For admin
});

// For patch/update, usually fields are optional
const updatePropertySchema = convertToOptional(createPropertySchema);

function convertToOptional(schema) {
  return schema.fork(Object.keys(schema.describe().keys), (schema) =>
    schema.optional()
  );
}

module.exports = {
  createPropertySchema,
  updatePropertySchema,
};
