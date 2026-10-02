const fs = require('fs/promises')
const path = require('path')
const logger = require('../utils/logger')
const uploadsRoot = path.resolve(__dirname, '..', '..', 'uploads') + path.sep

module.exports = function failedUpload (error, req, res, next) {
  const files = [req.file, ...(Array.isArray(req.files) ? req.files : Object.values(req.files || {}).flat())].filter(Boolean)
  Promise.all(files.map(async (file) => {
    if (file.persisted || !file.path || !path.resolve(file.path).startsWith(uploadsRoot)) return
    try {
      await fs.unlink(file.path)
    } catch (cleanupError) {
      if (cleanupError.code !== 'ENOENT') logger.error('upload_cleanup_failed', { error: cleanupError.message })
    }
  })).then(() => next(error), () => next(error))
}
