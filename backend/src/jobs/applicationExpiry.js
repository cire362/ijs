const { Op } = require('sequelize')
const {
  Application
} = require('../models')
const { sequelize } = require('../db')
const { isPastDeadline } = require('../utils/applicationStatus')
const { expireApplication } = require('../services/applicationLifecycle')

async function expireSentApplications () {
  const now = new Date()

  const apps = await Application.findAll({
    where: {
      status: 'sent',
      expiresAt: { [Op.lte]: now }
    },
    attributes: ['id'],
    order: [['id', 'ASC']]
  })
  let processed = 0
  for (const candidate of apps) {
    const expired = await sequelize.transaction(async (transaction) => {
      const app = await Application.findByPk(candidate.id, {
        transaction, lock: transaction.LOCK.UPDATE
      })
      if (!app || !isPastDeadline(app)) return false
      await expireApplication(app, transaction)
      return true
    })
    if (expired) processed += 1
  }
  return { processed }
}

module.exports = { expireSentApplications }
