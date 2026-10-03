const { DataTypes } = require('sequelize')
const { sequelize } = require('../db')

// Only an HMAC of the emailed token is stored; a token is single-use and short-lived.
module.exports = sequelize.define('PasswordResetToken', {
  userId: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'users', key: 'id' } },
  tokenHash: { type: DataTypes.STRING(64), allowNull: false, unique: true },
  expiresAt: { type: DataTypes.DATE, allowNull: false },
  usedAt: { type: DataTypes.DATE },
  ip: { type: DataTypes.STRING }
}, { tableName: 'password_reset_tokens' })
