const Joi = require("joi");
const { isValidRuPhone } = require("../utils/phone");

const phoneSchema = Joi.string()
  .trim()
  .max(50)
  .required()
  .custom((value, helpers) => {
    if (!isValidRuPhone(value)) {
      return helpers.error("string.pattern.base");
    }
    return value;
  })
  .messages({
    "any.required": "Укажите телефон клиента",
    "string.empty": "Укажите телефон клиента",
    "string.max": "Телефон слишком длинный",
    "string.pattern.base":
      "Некорректный телефон (пример: +7 900 100-00-11 или 8 900 100-00-11)",
  });

const createApplicationSchema = Joi.object({
  propertyId: Joi.number().integer().required().messages({
    "any.required": "Некорректный propertyId",
  }),
  clientFullName: Joi.string().trim().max(200).allow(null, ""),
  clientPhone: Joi.string().trim().max(50).allow(null, ""),
  commissionAmount: Joi.number().min(0).allow(null),
  comment: Joi.string().max(2000).allow(null, ""),
});

const updateClientInfoSchema = Joi.object({
  clientFullName: Joi.string().trim().max(200).required().messages({
    "any.required": "Укажите ФИО клиента",
  }),
  clientPhone: phoneSchema,
});

const allowedStatuses = [
  "sent",
  "confirmed",
  "contract_signed",
  "awaiting_payment",
  "commission_available",
  "done",
  "rejected",
  "expired",
];

const updateStatusSchema = Joi.object({
  status: Joi.string()
    .valid(...allowedStatuses)
    .required()
    .messages({
      "any.only": "Недопустимый статус",
      "any.required": "Укажите статус",
    }),
  comment: Joi.string().max(500).allow(null, ""),
});

const extendDeadlineSchema = Joi.object({
  days: Joi.number().integer().min(1).max(60).default(7),
});

module.exports = {
  createApplicationSchema,
  updateClientInfoSchema,
  updateStatusSchema,
  extendDeadlineSchema,
};
