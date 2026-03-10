const { DataTypes, Model } = require('sequelize')
const { sequelize } = require('../db')
const Application = require('./application')
const User = require('./user')

class StatusHistory extends Model {}

StatusHistory.init(
  {
    applicationId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: Application, key: 'id' }
    },
    status: { type: DataTypes.STRING, allowNull: false },
    changedBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: User, key: 'id' }
    },
    comment: { type: DataTypes.TEXT }
  },
  { sequelize, modelName: 'status_history' }
)

module.exports = StatusHistory
