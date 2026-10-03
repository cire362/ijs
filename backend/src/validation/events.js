const Joi = require('joi')

const createEventSchema = Joi.object({
  title: Joi.string().trim().max(200).required().messages({
    'any.required': 'Укажите название мероприятия'
  }),
  description: Joi.string().max(5000).allow(null, ''),
  startAt: Joi.date().greater('now').required().messages({
    'any.required': 'Укажите дату начала',
    'date.greater': 'Дата начала должна быть в будущем'
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
  capacity: Joi.number().integer().min(1).max(1000000).empty('').allow(null),
  isTraining: Joi.boolean().default(false)
}).rename('maxParticipants', 'capacity')

const updateEventSchema = Joi.object({
  title: Joi.string().trim().max(200),
  description: Joi.string().max(5000).allow(null, ''),
  startAt: Joi.date().greater('now').messages({ 'date.greater': 'Дата начала должна быть в будущем' }),
  endAt: Joi.date().allow(null),
  location: Joi.string().trim().max(300).allow(null, ''),
  format: Joi.string().valid('online', 'offline', 'hybrid').allow(null, ''),
  capacity: Joi.number().integer().min(1).max(1000000).empty('').allow(null),
  isTraining: Joi.boolean()
}).rename('maxParticipants', 'capacity').min(1)

const cancelEventSchema = Joi.object({
  reason: Joi.string().trim().max(1000).allow(null, '')
})

const updateRegistrationStatusSchema = Joi.object({
  status: Joi.string().valid('approved', 'rejected').required().messages({
    'any.only': 'Некорректный статус',
    'any.required': 'Укажите статус'
  })
})

module.exports = {
  createEventSchema,
  updateEventSchema,
  cancelEventSchema,
  updateRegistrationStatusSchema
}
