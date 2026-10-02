const Joi = require('joi')

const roomId = Joi.string().max(255).pattern(/^(user:[1-9]\d*|guest:[A-Za-z0-9_-]{16,})$/).required()
const text = Joi.string().trim().min(1).max(5000).required()
const identity = {
  senderName: Joi.string().trim().max(255).allow(null, ''),
  senderEmail: Joi.string().trim().lowercase().email().max(255).allow(null, '')
}

module.exports = {
  supportRequestSchema: Joi.object({
    message: text,
    name: identity.senderName,
    email: identity.senderEmail
  }),
  supportHistorySchema: Joi.object({ roomId, guestToken: Joi.string().max(4096), ...require('./query').messagePagination }).oxor('beforeId', 'afterId'),
  supportRoomSchema: Joi.object({ roomId }),
  supportResolveSchema: Joi.object({ roomId, resolved: Joi.boolean().strict().required() }),
  socketMessageSchema: Joi.object({ text, ...identity }).unknown(false),
  socketReplySchema: Joi.object({ roomId, text }).unknown(false)
}
