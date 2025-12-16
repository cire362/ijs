const { DataTypes, Model } = require("sequelize");
const { sequelize } = require("../db");
const User = require("./user");

class Property extends Model {}

Property.init(
  {
    title: { type: DataTypes.STRING, allowNull: false },
    developerId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: User, key: "id" },
    },
    region: { type: DataTypes.STRING, allowNull: false },
    city: { type: DataTypes.STRING, allowNull: false },
    street: { type: DataTypes.STRING },
    plotNumber: { type: DataTypes.STRING },
    landArea: { type: DataTypes.FLOAT },
    houseArea: { type: DataTypes.FLOAT },
    floors: { type: DataTypes.INTEGER },
    rooms: { type: DataTypes.INTEGER },
    finishingType: { type: DataTypes.STRING },
    contractType: { type: DataTypes.STRING },
    constructionType: { type: DataTypes.STRING },
    readinessType: { type: DataTypes.STRING },
    saleStatus: {
      type: DataTypes.ENUM("available", "reserved", "sold"),
      defaultValue: "available",
    },
    buildStage: { type: DataTypes.STRING },
    price: { type: DataTypes.DECIMAL(14, 2) },
    description: { type: DataTypes.TEXT },
  },
  { sequelize, modelName: "property" }
);

module.exports = Property;
