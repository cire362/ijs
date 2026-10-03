const Joi = require('joi')

const id = Joi.number().integer().min(1).max(2147483647)
const pagination = {
  page: Joi.number().integer().min(1).max(1000000),
  limit: Joi.number().integer().min(1).max(1000000)
}
const text = Joi.string().trim().max(200).allow('')
// Optional page/limit pair for lists that historically returned a plain array.
const listPagination = {
  page: Joi.number().integer().min(1).max(100000),
  limit: Joi.number().integer().min(1).max(200)
}
const applicationStatus = Joi.string().valid('sent', 'confirmed', 'contract_signed', 'awaiting_payment', 'commission_available', 'done', 'rejected', 'expired', 'cancelled')
const propertyQuery = Joi.object({
  q: text,
  region: text,
  city: text,
  status: Joi.string().valid('available', 'reserved', 'sold').allow(''),
  rooms: Joi.number().integer().min(1),
  floors: Joi.number().integer().min(1),
  priceMin: Joi.number().min(0),
  priceMax: Joi.number().min(0),
  ...listPagination
}).and('page', 'limit').custom((value, helpers) => {
  if (value.priceMin != null && value.priceMax != null && value.priceMin > value.priceMax) {
    return helpers.message('Минимальная цена не может быть больше максимальной')
  }
  return value
})
const applicationListQuery = Joi.object({ ...listPagination, status: applicationStatus }).and('page', 'limit')
const incomingQuery = Joi.object({ ...listPagination, status: applicationStatus, developerId: id }).and('page', 'limit')
const eventsQuery = Joi.object({ ...pagination, q: text, training: Joi.boolean(), period: Joi.string().valid('upcoming', 'past') })
const registrationsQuery = Joi.object({ eventId: id, ...listPagination }).and('page', 'limit')
const newsQuery = Joi.object({ q: text, published: Joi.boolean(), ...listPagination }).and('page', 'limit')
const paginationQuery = Joi.object(pagination)
const notificationsQuery = Joi.object({
  ...pagination, q: text, type: text, isRead: Joi.boolean()
})
const developersQuery = Joi.object({
  q: text,
  search: text,
  status: Joi.string().valid('pending', 'approved', 'rejected').allow(''),
  approved: Joi.boolean()
})

const chatListQuery = Joi.object({ page: Joi.number().integer().min(1).max(100000), limit: Joi.number().integer().min(1).max(200) }).with('page', 'limit')
const messagePagination = { limit: Joi.number().integer().min(1).max(200), beforeId: id, afterId: id }
const chatMessagesQuery = Joi.object(messagePagination).oxor('beforeId', 'afterId')

module.exports = { listPagination, applicationListQuery, chatListQuery, chatMessagesQuery, messagePagination, propertyQuery, incomingQuery, eventsQuery, registrationsQuery, newsQuery, paginationQuery, notificationsQuery, developersQuery }
