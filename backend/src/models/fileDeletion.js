const { DataTypes } = require('sequelize')
const { sequelize } = require('../db')

module.exports = sequelize.define('FileDeletion', {
  url: { type: DataTypes.STRING, allowNull: false, unique: true },
  attempts: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  nextAttemptAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  lastError: { type: DataTypes.TEXT }
}, { tableName: 'file_deletions', indexes: [{ fields: ['next_attempt_at'] }] })
