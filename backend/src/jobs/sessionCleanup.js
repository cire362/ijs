const { Op } = require('sequelize')
const { AuthSession, PasswordResetToken } = require('../models')

// Expired and revoked sessions keep IP addresses and user agents; they are removed after a grace day.
async function cleanupAuthSessions ({ now = new Date(), graceMs = 86400000 } = {}) {
  const threshold = new Date(now.getTime() - graceMs)
  const deleted = await AuthSession.destroy({
    where: { [Op.or]: [{ expiresAt: { [Op.lt]: threshold } }, { revokedAt: { [Op.lt]: threshold } }] }
  })
  const resetTokens = await PasswordResetToken.destroy({ where: { expiresAt: { [Op.lt]: threshold } } })
  return { deleted, resetTokens }
}

module.exports = { cleanupAuthSessions }
