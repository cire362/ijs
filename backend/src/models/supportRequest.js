const { DataTypes } = require('sequelize')

module.exports = (sequelize) => {
  const SupportRequest = sequelize.define('SupportRequest', {
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    email: {
      type: DataTypes.STRING,
      allowNull: true
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    ip: {
      type: DataTypes.STRING,
      allowNull: true
    },
    status: {
      type: DataTypes.ENUM('new', 'read', 'replied'),
      defaultValue: 'new'
    }
  })

  return SupportRequest
}
