const { parseIntStrict } = require('../utils/validation')

// Sequelize uses PostgreSQL INTEGER identifiers. Validate before queries and uploads.
function idParam (req, res, next, value, name) {
  const id = parseIntStrict(value)
  if (id == null || id < 1 || id > 2147483647) {
    return res.status(400).json({ error: `Некорректный ${name}` })
  }
  req.params[name] = id
  next()
}

module.exports = idParam
