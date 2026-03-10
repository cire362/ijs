const { DataTypes, Model } = require('sequelize')
const { sequelize } = require('../db')

class TariffPropertyRate extends Model {}

TariffPropertyRate.init(
  {
    propertyId: { type: DataTypes.INTEGER, allowNull: false },
    category: {
      type: DataTypes.ENUM('apartments', 'commercial', 'parking', 'storage'),
      allowNull: false
    },
    commissionFrom: { type: DataTypes.DECIMAL(6, 3), allowNull: false },
    commissionTo: { type: DataTypes.DECIMAL(6, 3), allowNull: true },
    notes: { type: DataTypes.TEXT, allowNull: true },
    isActive: { type: DataTypes.BOOLEAN, defaultValue: true }
  },
  {
    sequelize,
    modelName: 'TariffPropertyRate',
    tableName: 'tariff_property_rates',
    indexes: [
      {
        unique: true,
        fields: ['property_id', 'category']
      }
    ]
  }
)

module.exports = TariffPropertyRate
