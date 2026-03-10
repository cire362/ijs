const { DataTypes, Model } = require('sequelize')
const { sequelize } = require('../db')

class TariffComplex extends Model {}

TariffComplex.init(
  {
    counterpartyId: { type: DataTypes.INTEGER, allowNull: false },
    name: { type: DataTypes.STRING, allowNull: false },
    isActive: { type: DataTypes.BOOLEAN, defaultValue: true }
  },
  {
    sequelize,
    modelName: 'TariffComplex',
    tableName: 'tariff_complexes'
  }
)

module.exports = TariffComplex
