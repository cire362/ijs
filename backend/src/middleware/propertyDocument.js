const path = require('path')
const asyncHandler = require('../utils/asyncHandler')
const { PropertyDocument } = require('../models')

module.exports = asyncHandler(async (req, res, next) => {
  let filename
  try { filename = decodeURIComponent(req.path).slice(1) } catch { return res.sendStatus(400) }
  if (!filename || filename.includes('\\') || path.basename(filename) !== filename) return res.sendStatus(404)
  const doc = await PropertyDocument.findOne({ where: { url: `/uploads/property_docs/${filename}` }, attributes: ['id', 'originalName'] })
  if (!doc) return res.sendStatus(404)
  res.set('Cache-Control', 'no-store')
  res.attachment(doc.originalName || filename)
  next()
})
