const { DataTypes, Model } = require('sequelize')
const { sequelize } = require('../db')
const Event = require('./event')
const User = require('./user')

class EventRegistration extends Model {}

EventRegistration.init(
  {
    eventId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: Event, key: 'id' }
    },
    agentId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: User, key: 'id' }
    },
    status: {
      type: DataTypes.ENUM('new', 'approved', 'rejected'),
      defaultValue: 'new'
    },
    comment: { type: DataTypes.TEXT }
  },
  {
    sequelize,
    modelName: 'event_registration',
    indexes: [{ unique: true, fields: ['event_id', 'agent_id'] }]
  }
)

module.exports = EventRegistration
