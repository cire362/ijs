const { DataTypes, Model } = require("sequelize");
const { sequelize } = require("../db");
const Property = require("./property");

class PropertyDocument extends Model {}

PropertyDocument.init(
  {
    propertyId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: Property, key: "id" },
    },
    url: { type: DataTypes.STRING, allowNull: false },
    originalName: { type: DataTypes.STRING }, // e.g. "my-contract.pdf"
    mimeType: { type: DataTypes.STRING },
  },
  { sequelize, modelName: "PropertyDocument", timestamps: true }
);

module.exports = PropertyDocument;
