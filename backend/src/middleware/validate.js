const logger = require('../utils/logger')
const { requestPath } = require('../utils/requestPath')
const { MESSAGES, localize } = require('../validation/messages')

const validate = (schema, property = 'body') => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      stripUnknown: true, // remove fields that are not in the schema
      messages: MESSAGES
    })

    if (error) {
      const details = error.details.map((detail) => ({
        message: localize(detail.message),
        path: detail.path
      }))
      logger.warn('validation_failed', {
        path: requestPath(req.originalUrl),
        property,
        details
      })
      return res.status(400).json({ error: details[0]?.message || 'Ошибка валидации', details })
    }

    req[property] = value
    next()
  }
}

module.exports = validate
