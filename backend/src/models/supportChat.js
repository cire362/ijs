const { DataTypes } = require('sequelize')
const { sequelize } = require('../db')

const SupportChat = sequelize.define('SupportChat', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  roomId: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  isResolved: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  resolvedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  resolvedBy: {
    type: DataTypes.INTEGER,
    allowNull: true
  }
})

module.exports = SupportChat
