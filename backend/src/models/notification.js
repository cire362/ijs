const { DataTypes, Model } = require("sequelize");
const { sequelize } = require("../db");
const User = require("./user");

class Notification extends Model {}

Notification.init(
  {
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: User, key: "id" },
    },
    type: { type: DataTypes.STRING },
    text: { type: DataTypes.TEXT, allowNull: false },
    isRead: { type: DataTypes.BOOLEAN, defaultValue: false },
    meta: { type: DataTypes.JSON },
  },
  { sequelize, modelName: "notification" }
);

module.exports = Notification;
