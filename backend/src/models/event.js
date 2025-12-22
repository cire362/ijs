const { DataTypes, Model } = require("sequelize");
const { sequelize } = require("../db");
const User = require("./user");

class Event extends Model {}

Event.init(
  {
    title: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.TEXT },
    location: { type: DataTypes.STRING },
    format: {
      type: DataTypes.ENUM("offline", "online", "hybrid"),
      allowNull: true,
    },
    coverImageUrl: { type: DataTypes.STRING, allowNull: true },
    startAt: { type: DataTypes.DATE, allowNull: false },
    endAt: { type: DataTypes.DATE },
    isTraining: { type: DataTypes.BOOLEAN, defaultValue: false },
    capacity: { type: DataTypes.INTEGER },
    createdBy: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: User, key: "id" },
    },
  },
  { sequelize, modelName: "event" }
);

module.exports = Event;
