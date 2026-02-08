const { DataTypes, Model } = require("sequelize");
const { sequelize } = require("../db");

class TariffCounterparty extends Model {}

TariffCounterparty.init(
  {
    type: {
      type: DataTypes.ENUM("developer", "contractor", "assignment"),
      allowNull: false,
    },
    name: { type: DataTypes.STRING, allowNull: false },
    userId: { type: DataTypes.INTEGER, allowNull: true },
    isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
  },
  {
    sequelize,
    modelName: "TariffCounterparty",
    tableName: "tariff_counterparties",
  },
);

module.exports = TariffCounterparty;
