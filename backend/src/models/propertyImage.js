const { DataTypes, Model } = require('sequelize')
const { sequelize } = require('../db')
const Property = require('./property')

class PropertyImage extends Model {}

PropertyImage.init(
  {
    propertyId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: Property, key: 'id' }
    },
    url: { type: DataTypes.STRING, allowNull: false },
    caption: { type: DataTypes.STRING }
  },
  { sequelize, modelName: 'property_image' }
)

module.exports = PropertyImage
