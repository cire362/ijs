const { DataTypes, Model } = require("sequelize");
const { sequelize } = require("../db");

class TariffRate extends Model {}

TariffRate.init(
  {
    complexId: { type: DataTypes.INTEGER, allowNull: false },
    category: {
      type: DataTypes.ENUM("apartments", "commercial", "parking", "storage"),
      allowNull: false,
    },
    commissionFrom: { type: DataTypes.DECIMAL(6, 3), allowNull: false },
    commissionTo: { type: DataTypes.DECIMAL(6, 3), allowNull: true },
    notes: { type: DataTypes.TEXT, allowNull: true },
    isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
  },
  {
    sequelize,
    modelName: "TariffRate",
    tableName: "tariff_rates",
    indexes: [
      {
        unique: true,
        fields: ["complex_id", "category"],
      },
    ],
  },
);

module.exports = TariffRate;
