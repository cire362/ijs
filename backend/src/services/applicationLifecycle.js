const { Op } = require('sequelize')
const { Application, StatusHistory, Notification, User } = require('../models')
const { RESERVING_STATUSES, statusLabelRu } = require('../utils/applicationStatus')

async function adminIds (transaction) {
  const admins = await User.findAll({ where: { role: 'admin', deletedAt: null }, attributes: ['id'], transaction })
  return admins.map((admin) => admin.id)
}

async function notifyUsers (userIds, notification, transaction) {
  const recipients = [...new Set(userIds.filter(Boolean))]
  if (!recipients.length) return
  await Notification.bulkCreate(recipients.map((userId) => ({ userId, ...notification })), { transaction })
}

// Changes the status, writes history and notifies the recipients (the author by default).
async function recordStatus (application, status, { comment, actorId = null, recipients, transaction }) {
  await application.update({ status, expiresAt: null }, { transaction })
  await StatusHistory.create({
    applicationId: application.id,
    status,
    changedBy: actorId,
    comment: comment || statusLabelRu(status)
  }, { transaction })
  await notifyUsers(recipients || [application.agentId], {
    type: 'application_status',
    text: `Заявка №${application.id} обновилась: ${statusLabelRu(status)}`,
    meta: { applicationId: application.id, propertyId: application.propertyId, status }
  }, transaction)
}

async function expireApplication (application, transaction) {
  await recordStatus(application, 'expired', { transaction })
}

// Frees the property when the closing application held the only reservation.
// A reservation set manually on the property is left untouched.
async function releaseReservation (application, property, transaction) {
  if (!RESERVING_STATUSES.includes(application.status) || property.saleStatus !== 'reserved') return
  const competing = await Application.count({
    where: { propertyId: property.id, id: { [Op.ne]: application.id }, status: { [Op.in]: RESERVING_STATUSES } },
    transaction
  })
  if (!competing) await property.update({ saleStatus: 'available' }, { transaction })
}

// Rejects the pending applications of a sold property. The caller holds the property lock.
async function rejectPendingApplications (propertyId, { exceptId, actorId, comment, transaction }) {
  const pending = await Application.findAll({
    where: { propertyId, status: 'sent', ...(exceptId ? { id: { [Op.ne]: exceptId } } : {}) },
    transaction,
    lock: transaction.LOCK.UPDATE,
    order: [['id', 'ASC']]
  })
  for (const other of pending) {
    await recordStatus(other, 'rejected', { comment, actorId, transaction })
  }
  return pending.length
}

module.exports = {
  adminIds,
  notifyUsers,
  recordStatus,
  expireApplication,
  releaseReservation,
  rejectPendingApplications
}
