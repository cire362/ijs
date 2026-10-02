const Joi = require('joi')
const { isValidRuPhone } = require('../utils/phone')

const email = Joi.string().trim().lowercase().email().max(255)
const phone = Joi.string().trim().max(50).custom((value, helpers) =>
  isValidRuPhone(value) ? value : helpers.error('any.invalid')
).messages({ 'any.invalid': 'Укажите корректный российский телефон' })
const password = Joi.string().min(8).max(200).custom((value, helpers) =>
  Buffer.byteLength(value, 'utf8') <= 72 ? value : helpers.error('any.invalid')
).messages({ 'any.invalid': 'Пароль должен занимать не более 72 байт в UTF-8' })
const nameFields = {
  firstName: Joi.string().trim().max(100).allow(null, ''),
  lastName: Joi.string().trim().max(100).allow(null, ''),
  middleName: Joi.string().trim().max(100).allow(null, '')
}

// The profile form always sends every field: an empty phone means "keep the current one",
// and an unchanged legacy phone is accepted as is (checked in the service).
const updateMeSchema = Joi.object({
  ...nameFields,
  email,
  phone: Joi.string().trim().max(50).allow(null, ''),
  companyName: Joi.string().trim().max(200).allow(null, '')
}).min(1)

const marketingConsentSchema = Joi.object({
  accepted: Joi.boolean().strict().required().messages({ 'any.required': 'Поле accepted должно быть boolean', 'boolean.base': 'Поле accepted должно быть boolean' }),
  documentVersion: Joi.string().trim().max(50).allow(null, '')
})

const createDeveloperSchema = Joi.object({
  ...nameFields,
  name: Joi.string().trim().max(200).allow(null, ''),
  email: email.required(),
  phone: phone.required(),
  password: password.required(),
  companyName: Joi.string().trim().max(200).required()
})

const deleteMeSchema = Joi.object({
  password: Joi.string().max(200).required().messages({ 'any.required': 'Подтвердите удаление паролем', 'string.empty': 'Подтвердите удаление паролем' })
})

const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().max(200).required(),
  newPassword: password.required()
})

module.exports = { email, phone, password, updateMeSchema, marketingConsentSchema, deleteMeSchema, createDeveloperSchema, changePasswordSchema }
