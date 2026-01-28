const { DataTypes, Model } = require("sequelize");
const { sequelize } = require("../db");
const Application = require("./application");
const User = require("./user");

class ApplicationChatMessage extends Model {}

ApplicationChatMessage.init(
  {
    applicationId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: Application, key: "id" },
    },
    senderId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: User, key: "id" },
    },
    senderRole: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    text: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    attachmentUrl: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    attachmentOriginalName: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    attachmentMimeType: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    attachmentSize: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  { sequelize, modelName: "ApplicationChatMessage", timestamps: true },
);

module.exports = ApplicationChatMessage;
