const { DataTypes } = require('sequelize')
const { sequelize } = require('../db')

module.exports = sequelize.define('EventReminder', {
  eventId: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'events', key: 'id' } },
  agentId: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'users', key: 'id' } },
  startAt: { type: DataTypes.DATE, allowNull: false },
  minutesBefore: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 60 },
  dueAt: { type: DataTypes.DATE, allowNull: false },
  status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'pending' },
  deliveredAt: { type: DataTypes.DATE }
}, {
  tableName: 'event_reminders',
  indexes: [
    { unique: true, fields: ['event_id', 'agent_id', 'start_at', 'minutes_before'] },
    { fields: ['status', 'due_at'] }
  ]
})
