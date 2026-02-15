const Joi = require("joi");

const consentSchema = Joi.object({
  legal: Joi.object({
    accepted: Joi.boolean().valid(true).required().messages({
      "any.only":
        "Необходимо согласие с пользовательским соглашением и политикой",
      "any.required":
        "Необходимо согласие с пользовательским соглашением и политикой",
    }),
    acceptedAt: Joi.date().iso().optional(),
    documentVersion: Joi.string().trim().max(50).required(),
    termsPath: Joi.string().trim().max(255).required(),
    privacyPath: Joi.string().trim().max(255).required(),
  })
    .required()
    .unknown(false),

  marketing: Joi.object({
    accepted: Joi.boolean().required(),
    acceptedAt: Joi.date().iso().allow(null),
    documentVersion: Joi.string().trim().max(50).allow(null, ""),
  })
    .required()
    .unknown(false),
})
  .required()
  .unknown(false);

const registerSchema = Joi.object({
  email: Joi.string().email().required().messages({
    "string.email": "Некорректный email",
    "any.required": "Укажите email",
  }),
  password: Joi.string().min(8).max(200).required().messages({
    "string.min": "Пароль должен быть не менее 8 символов",
    "any.required": "Укажите пароль",
  }),
  role: Joi.string().valid("agent", "developer").required().messages({
    "any.only": "Недопустимая роль",
    "any.required": "Укажите роль",
  }),
  firstName: Joi.string().trim().max(100).allow(null, ""),
  lastName: Joi.string().trim().max(100).allow(null, ""),
  middleName: Joi.string().trim().max(100).allow(null, ""),
  name: Joi.string().trim().max(200).allow(null, ""), // legacy support
  phone: Joi.string().trim().max(50).required().messages({
    "any.required": "Укажите телефон",
  }),
  companyName: Joi.string().trim().max(200).allow(null, ""),
  consent: consentSchema,
});

const loginSchema = Joi.object({
  email: Joi.string().trim().required().messages({
    "any.required": "Укажите email",
  }),
  password: Joi.string().required().messages({
    "any.required": "Укажите пароль",
  }),
});

module.exports = {
  registerSchema,
  loginSchema,
};
