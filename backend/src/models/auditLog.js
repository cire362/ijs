const { DataTypes } = require('sequelize')
const { sequelize } = require('../db')

module.exports = sequelize.define('AuditLog', {
  entityType: { type: DataTypes.STRING, allowNull: false },
  entityId: { type: DataTypes.INTEGER, allowNull: false },
  actorId: { type: DataTypes.INTEGER, references: { model: 'users', key: 'id' }, onDelete: 'SET NULL' },
  action: { type: DataTypes.STRING, allowNull: false },
  before: { type: DataTypes.JSONB },
  after: { type: DataTypes.JSONB }
}, { tableName: 'audit_logs', updatedAt: false, indexes: [{ fields: ['entity_type', 'entity_id', 'created_at'] }] })
