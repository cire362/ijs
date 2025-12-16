const { DataTypes, Model } = require("sequelize");
const { sequelize } = require("../db");
const Property = require("./property");
const User = require("./user");

class Application extends Model {}

Application.init(
  {
    propertyId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: Property, key: "id" },
    },
    agentId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: User, key: "id" },
    },
    status: {
      type: DataTypes.ENUM(
        "sent",
        "confirmed",
        "contract_signed",
        "awaiting_payment",
        "commission_available",
        "done",
        "rejected"
      ),
      defaultValue: "sent",
    },
    commissionAmount: { type: DataTypes.DECIMAL(14, 2) },
    comment: { type: DataTypes.TEXT },
  },
  { sequelize, modelName: "application" }
);

module.exports = Application;
