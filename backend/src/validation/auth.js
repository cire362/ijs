const Joi = require("joi");

const registerSchema = Joi.object({
  email: Joi.string().email().required().messages({
    "string.email": "Некорректный email",
    "any.required": "Укажите email",
  }),
  password: Joi.string().min(6).max(200).required().messages({
    "string.min": "Пароль должен быть не менее 6 символов",
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
