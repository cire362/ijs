const Joi = require("joi");

const phoneSchema = Joi.string()
  .trim()
  .max(50)
  .required()
  .custom((value, helpers) => {
    const raw = String(value || "").trim();
    const digits = raw.replace(/\D/g, "");

    // E.164-like: "+" and 11..15 digits total (e.g. +79001234567)
    if (raw.startsWith("+")) {
      if (digits.length >= 11 && digits.length <= 15) return raw;
      return helpers.error("string.pattern.base");
    }

    // RU fallback: 11 digits starting with 7 or 8 (allow spaces/dashes/etc)
    if (digits.length === 11 && (digits.startsWith("7") || digits.startsWith("8"))) {
      return raw;
    }

    return helpers.error("string.pattern.base");
  })
  .messages({
    "any.required": "Укажите телефон клиента",
    "string.empty": "Укажите телефон клиента",
    "string.max": "Телефон слишком длинный",
    "string.pattern.base":
      "Некорректный телефон (пример: +79001234567 или 8 900 123-45-67)",
  });

const createApplicationSchema = Joi.object({
  propertyId: Joi.number().integer().required().messages({
    "any.required": "Некорректный propertyId",
  }),
  clientFullName: Joi.string().trim().max(200).required().messages({
    "any.required": "Укажите ФИО клиента",
  }),
  clientPhone: phoneSchema,
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
