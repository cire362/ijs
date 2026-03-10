const { DataTypes, Model } = require('sequelize')
const { sequelize } = require('../db')
const News = require('./news')

class NewsImage extends Model {}

NewsImage.init(
  {
    newsId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: News, key: 'id' }
    },
    url: { type: DataTypes.STRING, allowNull: false },
    caption: { type: DataTypes.STRING }
  },
  { sequelize, modelName: 'news_image' }
)

module.exports = NewsImage
