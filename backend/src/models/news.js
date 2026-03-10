const { DataTypes, Model } = require('sequelize')
const { sequelize } = require('../db')
const User = require('./user')

class News extends Model {}

News.init(
  {
    title: { type: DataTypes.STRING, allowNull: false },
    subtitle: { type: DataTypes.STRING },
    excerpt: { type: DataTypes.TEXT },
    content: { type: DataTypes.TEXT, allowNull: false },
    isPublished: { type: DataTypes.BOOLEAN, defaultValue: true },
    publishedAt: { type: DataTypes.DATE },
    authorId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: User, key: 'id' }
    }
  },
  { sequelize, modelName: 'news' }
)

module.exports = News
