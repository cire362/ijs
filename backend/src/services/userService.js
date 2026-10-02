const { queueFileDeletion } = require('../jobs/fileCleanup')
const { Op } = require('sequelize')
const bcrypt = require('bcryptjs')
const {
  Property, User, Notification, AuthSession, Application, Event, EventRegistration, EventReminder,
  ChatMessage, SupportRequest, PasswordResetToken, AuditLog
} = require('../models')
const { RESERVING_STATUSES } = require('../utils/applicationStatus')
const { recordStatus, adminIds } = require('./applicationLifecycle')
const { randomToken } = require('../utils/authTokens')
const { sequelize } = require('../db')
const { formatRuPhone } = require('../utils/phone')
const { assertUniqueIdentity } = require('../utils/userIdentity')
const { disconnectSessions } = require('../socket')

function normalizeSpace (s) {
  if (!s) return s
  return String(s).replace(/\s+/g, ' ').trim()
}

function toPublicUser (user) {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    middleName: user.middleName,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    role: user.role,
    companyName: user.companyName,
    developerApproved: user.developerApproved,
    developerRejected: user.developerRejected,
    avatarUrl: user.avatarUrl,
    legalConsentAcceptedAt: user.legalConsentAcceptedAt,
    legalConsentVersion: user.legalConsentVersion,
    marketingConsentGiven: Boolean(user.marketingConsentGiven),
    marketingConsentAcceptedAt: user.marketingConsentAcceptedAt,
    marketingConsentWithdrawnAt: user.marketingConsentWithdrawnAt,
    marketingConsentVersion: user.marketingConsentVersion,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  }
}

class UserService {
  async getMe (user) {
    return toPublicUser(user)
  }

  async updateMe (user, data) {
    const updates = {}
    for (const key of ['firstName', 'lastName', 'middleName']) {
      if (data[key] !== undefined) updates[key] = normalizeSpace(data[key]) || null
    }
    if (data.email !== undefined) {
      updates.email = normalizeSpace(data.email || '').toLowerCase()
      if (!updates.email) throw { status: 400, message: 'Email не может быть пустым' }
    }
    return sequelize.transaction(async (transaction) => {
      const current = await User.findByPk(user.id, { transaction, lock: transaction.LOCK.UPDATE })
      const phoneInput = normalizeSpace(data.phone)
      if (phoneInput && phoneInput !== current.phone) {
        updates.phone = formatRuPhone(phoneInput)
        if (!updates.phone) throw { status: 400, message: 'Укажите корректный российский телефон' }
        if (updates.phone === current.phone) delete updates.phone
      }
      if (data.companyName !== undefined) {
        const companyName = normalizeSpace(data.companyName) || null
        if (current.role === 'individual') {
          updates.companyName = null // Individuals act for themselves, as at registration.
        } else if (['agent', 'developer'].includes(current.role) && !companyName) {
          throw { status: 400, message: 'Укажите компанию' }
        } else {
          updates.companyName = companyName
        }
      }
      if (updates.email === current.email) delete updates.email
      await assertUniqueIdentity({ email: updates.email, phone: updates.phone, exceptId: user.id, transaction })
      await current.update(updates, { transaction })
      return toPublicUser(current)
    })
  }

  async uploadMyAvatar (user, file) {
    if (!file) throw { status: 400, message: 'Файл не загружен' }
    return sequelize.transaction(async (transaction) => {
      const current = await User.findByPk(user.id, { transaction, lock: transaction.LOCK.UPDATE })
      await queueFileDeletion([current.avatarUrl], transaction)
      await current.update({ avatarUrl: `/uploads/avatars/${file.filename}` }, { transaction })
      transaction.afterCommit(() => { file.persisted = true })
      return toPublicUser(current)
    })
  }

  async changeMyPassword (user, currentPassword, newPassword, sessionId) {
    if (!currentPassword || !newPassword || newPassword.length < 8 || Buffer.byteLength(newPassword, 'utf8') > 72) {
      throw { status: 400, message: 'Проверьте текущий и новый пароль (8 символов, не более 72 байт)' }
    }
    const passwordHash = await bcrypt.hash(newPassword, 10)
    await sequelize.transaction(async (transaction) => {
      const current = await User.findByPk(user.id, { transaction, lock: transaction.LOCK.UPDATE })
      if (!(await bcrypt.compare(currentPassword, current.passwordHash))) {
        throw { status: 400, message: 'Текущий пароль неверный' }
      }
      await current.update({ passwordHash }, { transaction })
      const sessions = await AuthSession.findAll({
        where: { userId: user.id, ...(sessionId ? { id: { [Op.ne]: sessionId } } : {}) }, transaction
      })
      await AuthSession.destroy({ where: { id: sessions.map((session) => session.id) }, transaction })
      transaction.afterCommit(() => disconnectSessions(sessions.map((session) => session.id)))
    })
  }

  async setMyMarketingConsent (user, { accepted, documentVersion }) {
    const decision = Boolean(accepted)
    const now = new Date()

    if (decision) {
      await user.update({
        marketingConsentGiven: true,
        marketingConsentAcceptedAt: now,
        marketingConsentWithdrawnAt: null,
        marketingConsentVersion:
          normalizeSpace(documentVersion) ||
          user.marketingConsentVersion ||
          null
      })
    } else {
      await user.update({
        marketingConsentGiven: false,
        marketingConsentWithdrawnAt: now,
        marketingConsentVersion:
          normalizeSpace(documentVersion) ||
          user.marketingConsentVersion ||
          null
      })
    }

    return toPublicUser(user)
  }

  async listDevelopers (query) {
    const q = normalizeSpace(query.q || query.search)
    const status = String(query.status || '').trim()
    const approvedRaw = query.approved

    const where = { role: 'developer', deletedAt: null }

    if (status === 'pending') {
      where.developerApproved = false
      where.developerRejected = false
    } else if (status === 'approved') {
      where.developerApproved = true
    } else if (status === 'rejected') {
      where.developerApproved = false
      where.developerRejected = true
    } else {
      const approvedFilter =
        approvedRaw == null || approvedRaw === ''
          ? null
          : ['1', 'true', 1, true].includes(approvedRaw)
              ? true
              : ['0', 'false', 0, false].includes(approvedRaw)
                  ? false
                  : null

      if (approvedFilter === false) {
        where.developerApproved = false
        where.developerRejected = false
      } else if (approvedFilter === true) {
        where.developerApproved = true
      }
    }

    if (q) {
      where[Op.or] = [
        { email: { [Op.iLike]: `%${q}%` } },
        { companyName: { [Op.iLike]: `%${q}%` } },
        { firstName: { [Op.iLike]: `%${q}%` } },
        { lastName: { [Op.iLike]: `%${q}%` } },
        { middleName: { [Op.iLike]: `%${q}%` } }
      ]
    }

    const users = await User.findAll({
      where,
      order: [['companyName', 'ASC']],
      limit: 200
    })
    return users.map(toPublicUser)
  }

  async approveDeveloper (id) {
    return sequelize.transaction(async (transaction) => {
      const user = await User.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE })
      if (!user) throw { status: 404, message: 'Застройщик не найден' }
      if (user.role !== 'developer') throw { status: 400, message: 'Пользователь не является застройщиком' }
      if (user.developerApproved) return toPublicUser(user)
      await user.update({ developerApproved: true, developerRejected: false }, { transaction })
      await Notification.create({
        userId: user.id,
        type: 'developer_status',
        text: 'Ваша регистрация застройщика подтверждена администратором.',
        meta: { developerId: user.id, status: 'approved' }
      }, { transaction })
      return toPublicUser(user)
    })
  }

  async rejectDeveloper (id) {
    return sequelize.transaction(async (transaction) => {
      const user = await User.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE })
      if (!user) throw { status: 404, message: 'Застройщик не найден' }
      if (user.role !== 'developer') throw { status: 400, message: 'Пользователь не является застройщиком' }
      if (user.developerApproved) throw { status: 409, message: 'Застройщик уже подтверждён' }
      if (user.developerRejected) return toPublicUser(user)
      await user.update({ developerApproved: false, developerRejected: true }, { transaction })
      const sessions = await AuthSession.findAll({ where: { userId: id }, attributes: ['id'], transaction })
      await AuthSession.destroy({ where: { userId: id }, transaction })
      transaction.afterCommit(() => disconnectSessions(sessions.map((session) => session.id)))
      await Notification.create({
        userId: user.id,
        type: 'developer_status',
        text: 'Ваша регистрация застройщика отклонена администратором.',
        meta: { developerId: user.id, status: 'rejected' }
      }, { transaction })
      return toPublicUser(user)
    })
  }

  async deleteDeveloperRequest (id) {
    return sequelize.transaction(async (transaction) => {
      const user = await User.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE })
      if (!user) throw { status: 404, message: 'Не найдено' }
      if (user.role !== 'developer') {
        throw { status: 400, message: 'Пользователь не является застройщиком' }
      }
      if (user.developerApproved) {
        throw {
          status: 400,
          message: 'Нельзя удалить подтверждённого застройщика'
        }
      }

      const propsCount = await Property.count({
        where: { developerId: user.id }, transaction
      })
      if (propsCount > 0) {
        throw { status: 400, message: 'Нельзя удалить застройщика с объектами' }
      }

      const sessions = await AuthSession.findAll({ where: { userId: id }, attributes: ['id'], transaction })
      await AuthSession.destroy({ where: { userId: id }, transaction })
      await queueFileDeletion([user.avatarUrl], transaction)
      await user.destroy({ transaction })
      transaction.afterCommit(() => disconnectSessions(sessions.map((session) => session.id)))
    })
  }

  // Deletion at the owner's request (152-FZ): personal data is anonymized while deal history,
  // which other parties rely on, is kept without identifying the person.
  async deleteMe (user, password) {
    const passwordHash = await bcrypt.hash(randomToken(32), 10)
    const sessionIds = await sequelize.transaction(async (transaction) => {
      const current = await User.findByPk(user.id, { transaction, lock: transaction.LOCK.UPDATE })
      if (!current || current.deletedAt) throw { status: 404, message: 'Аккаунт не найден' }
      if (!(await bcrypt.compare(String(password || ''), current.passwordHash))) {
        throw { status: 400, message: 'Неверный пароль' }
      }
      if (current.role === 'admin' && !(await adminIds(transaction)).some((id) => id !== current.id)) {
        throw { status: 409, message: 'Нельзя удалить единственного администратора' }
      }
      if (current.role === 'developer' && await Property.count({ where: { developerId: current.id }, transaction })) {
        throw { status: 409, message: 'У застройщика есть объекты. Передайте или удалите их через администратора' }
      }
      if (await Application.count({ where: { agentId: current.id, status: { [Op.in]: RESERVING_STATUSES } }, transaction })) {
        throw { status: 409, message: 'Есть сделки в работе. Дождитесь их завершения или отзовите заявки' }
      }

      const pending = await Application.findAll({
        where: { agentId: current.id, status: 'sent' }, transaction, lock: transaction.LOCK.UPDATE, order: [['id', 'ASC']]
      })
      const admins = await adminIds(transaction)
      for (const application of pending) {
        const property = await Property.findByPk(application.propertyId, { attributes: ['developerId'], transaction })
        await recordStatus(application, 'cancelled', {
          comment: 'Аккаунт автора удалён', actorId: current.id, recipients: [property?.developerId, ...admins], transaction
        })
      }
      if (current.role === 'individual') {
        // The individual was the client; completed deals keep the data as contract records.
        await Application.update(
          { clientFullName: 'Удалённый пользователь', clientPhone: null },
          { where: { agentId: current.id, status: { [Op.ne]: 'done' } }, transaction }
        )
      }

      const upcoming = await Event.findAll({ where: { startAt: { [Op.gt]: new Date() } }, attributes: ['id'], transaction })
      const upcomingIds = upcoming.map((event) => event.id)
      if (upcomingIds.length) {
        await EventRegistration.destroy({ where: { agentId: current.id, eventId: upcomingIds }, transaction })
      }
      await EventReminder.update({ status: 'cancelled' }, { where: { agentId: current.id, status: 'pending' }, transaction })
      await ChatMessage.update({ senderName: null, senderEmail: null }, { where: { senderId: current.id }, transaction })
      await SupportRequest.update(
        { name: 'Удалённый пользователь', email: null, ip: null },
        { where: { email: current.email }, transaction }
      )
      await Notification.destroy({ where: { userId: current.id }, transaction })
      await PasswordResetToken.destroy({ where: { userId: current.id }, transaction })
      await queueFileDeletion([current.avatarUrl], transaction)

      const now = new Date()
      await current.update({
        email: `deleted-${current.id}@deleted.invalid`,
        phone: null,
        name: null,
        lastName: 'Удалённый',
        firstName: 'пользователь',
        middleName: null,
        companyName: null,
        avatarUrl: null,
        passwordHash,
        developerApproved: false,
        marketingConsentGiven: false,
        marketingConsentWithdrawnAt: current.marketingConsentGiven ? now : current.marketingConsentWithdrawnAt,
        deletedAt: now
      }, { transaction })
      await AuditLog.create({
        entityType: 'user', entityId: current.id, actorId: current.id, action: 'account_deleted', before: { role: current.role }, after: null
      }, { transaction })

      const sessions = await AuthSession.findAll({ where: { userId: current.id }, attributes: ['id'], transaction })
      await AuthSession.destroy({ where: { userId: current.id }, transaction })
      return sessions.map((session) => session.id)
    })
    disconnectSessions(sessionIds)
  }

  async createDeveloperByAdmin (data) {
    const email = normalizeSpace(data.email || '').toLowerCase()
    const phone = formatRuPhone(data.phone)
    if (!email || !phone || !data.password || !data.companyName) {
      throw { status: 400, message: 'Email, телефон, пароль и компания обязательны' }
    }
    const passwordHash = await bcrypt.hash(data.password, 10)
    const parts = String(data.name || '').trim().split(/\s+/)
    return sequelize.transaction(async (transaction) => {
      await assertUniqueIdentity({ email, phone, transaction })
      const user = await User.create({
        firstName: data.firstName || parts[1] || null,
        lastName: data.lastName || parts[0] || null,
        middleName: data.middleName || parts.slice(2).join(' ') || null,
        email,
        phone,
        passwordHash,
        role: 'developer',
        companyName: normalizeSpace(data.companyName),
        developerApproved: true,
        developerRejected: false
      }, { transaction })
      return toPublicUser(user)
    })
  }
}

module.exports = new UserService()
