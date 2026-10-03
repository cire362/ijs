const { DataTypes, Model } = require('sequelize')
const { sequelize } = require('../db')
const User = require('./user')

class Notification extends Model {}

Notification.init(
  {
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: User, key: 'id' }
    },
    type: { type: DataTypes.STRING },
    key: { type: DataTypes.STRING },
    text: { type: DataTypes.TEXT, allowNull: false },
    isRead: { type: DataTypes.BOOLEAN, defaultValue: false },
    meta: { type: DataTypes.JSON }
  },
  {
    sequelize,
    modelName: 'notification',
    indexes: [{ unique: true, fields: ['user_id', 'key'] }]
  }
)

module.exports = Notification

function publish (notifications, options = {}) {
  const emit = () => {
    const { getIO } = require('../socket')
    const io = getIO()
    if (!io) return
    for (const notification of notifications) {
      io.to(`user:${notification.userId}`).emit('notification', notification.toJSON())
    }
  }
  // A rolled-back operation must never appear in a user's notification stream.
  // findOrCreate runs inside a savepoint whose hooks fire on release, so wait for the root transaction.
  let transaction = options.transaction
  while (transaction?.parent) transaction = transaction.parent
  if (transaction) transaction.afterCommit(emit)
  else emit()
}

Notification.addHook('afterCreate', 'publishNotification', (notification, options) => publish([notification], options))
Notification.addHook('afterBulkCreate', 'publishNotifications', publish)
