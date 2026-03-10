const { DataTypes, Model } = require('sequelize')
const { sequelize } = require('../db')
const User = require('./user')

class AuthSession extends Model {}

AuthSession.init(
  {
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: User, key: 'id' }
    },

    refreshTokenHash: {
      type: DataTypes.STRING(128),
      allowNull: false,
      field: 'refresh_token_hash'
    },

    replacedById: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'replaced_by_id'
    },

    revokedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'revoked_at'
    },

    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'expires_at'
    },

    ip: { type: DataTypes.STRING(64), allowNull: true },
    userAgent: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'user_agent'
    }
  },
  {
    sequelize,
    modelName: 'auth_session',
    indexes: [
      { unique: true, fields: ['refresh_token_hash'] },
      { fields: ['user_id'] },
      { fields: ['expires_at'] },
      { fields: ['revoked_at'] }
    ]
  }
)

module.exports = AuthSession
