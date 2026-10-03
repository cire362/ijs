const express = require('express')
const Joi = require('joi')
const rateLimit = require('express-rate-limit')
const asyncHandler = require('../utils/asyncHandler')
const validate = require('../middleware/validate')
const { authenticate } = require('../middleware/auth')
const { suggest } = require('../services/addressService')

const router = express.Router()

// Suggestions spend the provider quota, so they need an account and have their own limit.
const suggestLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 90,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Слишком много запросов подсказок, попробуйте немного позже' }
})

const suggestQuery = Joi.object({
  q: Joi.string().trim().max(300).allow('').required(),
  kind: Joi.string().valid('address', 'region', 'city', 'street').default('address'),
  region: Joi.string().trim().max(200).allow(''),
  city: Joi.string().trim().max(200).allow(''),
  count: Joi.number().integer().min(1).max(10).default(7)
})

router.get('/suggest', authenticate, suggestLimit, validate(suggestQuery, 'query'), asyncHandler(async (req, res) => {
  const { q, kind, region, city, count } = req.query
  const { items, source } = await suggest({ kind, query: q, region: region || null, city: city || null, count })
  res.set('X-Address-Source', source)
  res.json(items)
}))

module.exports = router
