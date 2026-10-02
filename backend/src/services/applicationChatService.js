const { Op, QueryTypes } = require('sequelize')
const { sequelize } = require('../db')
const { messageOptions } = require('../utils/chatPagination')
const {
  Application,
  Property,
  ApplicationChatMessage,
  Notification,
  User
} = require('../models')
const { adminIds } = require('./applicationLifecycle')

function canAccessApplicationChat (app, user) {
  if (!user) return false
  if (!app) return false

  if (user.role === 'admin') return true
  if (['agent', 'individual'].includes(user.role) && app.agentId === user.id) { return true }

  return false
}

// One unread notification per chat and recipient is enough to bring them back to it.
async function notifyChatRecipients (app, recipients, message, transaction) {
  if (!recipients.length) return
  const unread = await Notification.findAll({
    where: {
      userId: recipients,
      type: 'application_chat_message',
      isRead: false,
      [Op.and]: [sequelize.where(sequelize.literal("(meta->>'applicationId')"), String(app.id))]
    },
    attributes: ['userId'],
    transaction
  })
  const notified = new Set(unread.map((note) => note.userId))
  const pending = recipients.filter((id) => !notified.has(id))
  if (!pending.length) return
  await Notification.bulkCreate(pending.map((userId) => ({
    userId,
    type: 'application_chat_message',
    text: `Новое сообщение в чате заявки №${app.id}${app.property?.title ? ` («${app.property.title}»)` : ''}`,
    meta: { applicationId: app.id, propertyId: app.propertyId, messageId: message.id }
  })), { transaction })
}

function normalizeText (v) {
  const s = String(v ?? '').trim()
  return s.length ? s : ''
}

class ApplicationChatService {
  async listChats (user, query = {}) {
    if (!user) {
      const err = new Error('Токен отсутствует')
      err.status = 401
      throw err
    }
    if (!['admin', 'agent', 'individual'].includes(user.role)) {
      const err = new Error('Доступ запрещён')
      err.status = 403
      throw err
    }

    const appsWhere = {}
    if (['agent', 'individual'].includes(user.role)) {
      appsWhere.agentId = user.id
    }

    const apps = await Application.findAll({
      where: appsWhere,
      include: [
        { model: Property },
        {
          model: User,
          as: 'agent',
          attributes: ['id', 'firstName', 'lastName', 'middleName', 'email']
        }
      ],
      order: [['createdAt', 'DESC'], ['id', 'DESC']],
      limit: query.limit,
      offset: query.limit ? ((query.page || 1) - 1) * query.limit : undefined
    })

    if (!apps.length) return []

    const appIds = apps.map((a) => a.id)

    const messages = await sequelize.query(`SELECT DISTINCT ON (application_id)
      application_id AS "applicationId", text, created_at AS "createdAt", attachment_original_name AS "attachmentOriginalName"
      FROM application_chat_messages WHERE application_id IN (:appIds)
      ORDER BY application_id, created_at DESC, id DESC`, { replacements: { appIds }, type: QueryTypes.SELECT })

    const lastByAppId = new Map()
    for (const m of messages) {
      if (!lastByAppId.has(m.applicationId)) {
        lastByAppId.set(m.applicationId, m)
      }
    }

    return apps.map((app) => {
      const last = lastByAppId.get(app.id) || null
      const lastText = String(last?.text || '').trim()
      const lastMessage =
        lastText ||
        (last?.attachmentOriginalName
          ? `Файл: ${last.attachmentOriginalName}`
          : '')

      return {
        applicationId: app.id,
        title: app.property?.title || `Заявка №${app.id}`,
        lastMessage: lastMessage || '',
        lastTime: last?.createdAt || app.createdAt,
        agent: app.agent
      }
    })
  }

  async _getAppForChat (applicationId) {
    const app = await Application.findByPk(applicationId, {
      include: [{ model: Property }]
    })
    return app
  }

  async listMessages (applicationId, user, query = {}) {
    const app = await this._getAppForChat(applicationId)
    if (!app) {
      const err = new Error('Заявка не найдена')
      err.status = 404
      throw err
    }
    if (!canAccessApplicationChat(app, user)) {
      const err = new Error('Доступ запрещён')
      err.status = 403
      throw err
    }

    const { options, reverse } = await messageOptions(ApplicationChatMessage, { applicationId: app.id }, query)
    const messages = await ApplicationChatMessage.findAll({
      ...options,
      include: [
        {
          model: User,
          as: 'sender',
          attributes: [
            'id',
            'firstName',
            'lastName',
            'middleName',
            'role',
            'email'
          ]
        }
      ]
    })

    return reverse ? messages.reverse() : messages
  }

  async createMessage (applicationId, { text }, file, user) {
    const app = await this._getAppForChat(applicationId)
    if (!app) {
      const err = new Error('Заявка не найдена')
      err.status = 404
      throw err
    }
    if (!canAccessApplicationChat(app, user)) {
      const err = new Error('Доступ запрещён')
      err.status = 403
      throw err
    }

    if (text != null && (typeof text !== 'string' || text.trim().length > 5000)) {
      throw { status: 400, message: 'Сообщение должно быть текстом длиной не более 5000 символов' }
    }
    const cleanText = normalizeText(text)
    if (!cleanText && !file) {
      const err = new Error('Сообщение не может быть пустым')
      err.status = 400
      throw err
    }

    const payload = {
      applicationId: app.id,
      senderId: user.id,
      senderRole: user.role,
      text: cleanText || null,
      attachmentUrl: null,
      attachmentOriginalName: null,
      attachmentMimeType: null,
      attachmentSize: null
    }

    if (file) {
      payload.attachmentUrl = `/uploads/application_docs/${file.filename}`
      payload.attachmentOriginalName = file.originalname
      payload.attachmentMimeType = file.mimetype
      payload.attachmentSize = file.size
    }

    const created = await sequelize.transaction(async (transaction) => {
      const message = await ApplicationChatMessage.create(payload, { transaction })
      // The author is notified about support replies; administrators about author messages.
      const recipients = user.role === 'admin' ? [app.agentId] : await adminIds(transaction)
      await notifyChatRecipients(app, recipients.filter((id) => id !== user.id), message, transaction)
      return message
    })
    if (file) file.persisted = true
    const withSender = await ApplicationChatMessage.findByPk(created.id, {
      include: [
        {
          model: User,
          as: 'sender',
          attributes: [
            'id',
            'firstName',
            'lastName',
            'middleName',
            'role',
            'email'
          ]
        }
      ]
    })

    return withSender
  }
}

module.exports = new ApplicationChatService()
module.exports.canAccessApplicationChat = canAccessApplicationChat
