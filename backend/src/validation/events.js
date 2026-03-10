const Joi = require('joi')

const createEventSchema = Joi.object({
  title: Joi.string().trim().max(200).required().messages({
    'any.required': 'Укажите название мероприятия'
  }),
  description: Joi.string().max(5000).allow(null, ''),
  startAt: Joi.date().required().messages({
    'any.required': 'Укажите дату начала'
  }),
  endAt: Joi.date().greater(Joi.ref('startAt')).allow(null).messages({
    'date.base': 'Некорректная дата окончания',
    'date.greater': 'Дата окончания должна быть позже даты начала'
  }),
  location: Joi.string().trim().max(300).allow(null, ''),
  format: Joi.string()
    .valid('online', 'offline', 'hybrid')
    .default('offline')
    .allow(null),
  maxParticipants: Joi.number().integer().min(1).allow(null),
  isTraining: Joi.boolean().default(false)
})

const updateRegistrationStatusSchema = Joi.object({
  status: Joi.string().valid('approved', 'rejected').required().messages({
    'any.only': 'Некорректный статус',
    'any.required': 'Укажите статус'
  })
})

module.exports = {
  createEventSchema,
  updateRegistrationStatusSchema
}
