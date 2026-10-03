const { QueryTypes } = require('sequelize')
const { messageOptions } = require('../utils/chatPagination')
const { sequelize } = require('../db')
const { ChatMessage, SupportChat } = require('../models')
const { socketMessageSchema, socketReplySchema } = require('../validation/support')

function validatePayload (schema, data) {
  const { value, error } = schema.validate(data, { stripUnknown: true })
  if (error) throw { status: 400, message: 'Введите сообщение длиной от 1 до 5000 символов и корректные данные чата' }
  return value
}

async function saveSupportMessage (roomId, payload, user) {
  const value = validatePayload(socketMessageSchema, {
    text: payload?.text,
    senderName: payload?.senderName || payload?.name,
    senderEmail: payload?.senderEmail || payload?.email
  })
  const senderName = user ? user.fullName || user.email : value.senderName || null
  const senderEmail = user ? user.email : value.senderEmail || null
  return sequelize.transaction(async (transaction) => {
    const message = await ChatMessage.create({
      senderId: user?.id || null,
      senderName,
      senderEmail,
      text: value.text,
      isAdmin: false,
      roomId,
      isRead: false
    }, { transaction })
    const [affected] = await SupportChat.update(
      { isResolved: false, resolvedAt: null, resolvedBy: null },
      { where: { roomId, isResolved: true }, transaction }
    )
    // Explicit fields keep authentication tokens out of the admin notification.
    return {
      id: message.id,
      text: message.text,
      senderName,
      senderEmail,
      roomId,
      timestamp: message.createdAt,
      isResolved: false,
      movedToNew: affected > 0
    }
  })
}

async function saveSupportReply (payload, user) {
  const value = validatePayload(socketReplySchema, { roomId: payload?.roomId, text: payload?.text })
  const message = await ChatMessage.create({
    senderId: user.id, text: value.text, isAdmin: true, roomId: value.roomId, isRead: true
  })
  return { roomId: value.roomId, text: message.text, sender: 'support', timestamp: message.createdAt }
}

async function listSupportChats (query = {}) {
  return sequelize.query(`SELECT latest.room_id AS "roomId",
    COALESCE(identity.sender_name, 'Гость') AS "senderName", identity.sender_email AS "senderEmail",
    latest.text AS "lastMessage", latest.created_at AS "lastTime", incoming.unread::int AS "unreadCount",
    COALESCE(state.is_resolved, false) AS "isResolved", state.resolved_at AS "resolvedAt", state.resolved_by AS "resolvedBy"
    FROM (SELECT DISTINCT ON (room_id) room_id, text, created_at, id FROM chat_messages
      ORDER BY room_id, created_at DESC, id DESC) latest
    LEFT JOIN LATERAL (SELECT sender_name, sender_email FROM chat_messages
      WHERE room_id = latest.room_id AND NOT is_admin AND (sender_name IS NOT NULL OR sender_email IS NOT NULL)
      ORDER BY created_at DESC, id DESC LIMIT 1) identity ON true
    LEFT JOIN LATERAL (SELECT count(*) AS unread FROM chat_messages
      WHERE room_id = latest.room_id AND NOT is_admin AND NOT is_read) incoming ON true
    LEFT JOIN support_chats state ON state.room_id = latest.room_id
    ORDER BY latest.created_at DESC, latest.id DESC
    ${query.limit ? 'LIMIT :limit OFFSET :offset' : ''}`, {
    type: QueryTypes.SELECT, replacements: { limit: query.limit || 200, offset: ((query.page || 1) - 1) * (query.limit || 200) }
  })
}

async function listSupportMessages (roomId, query = {}) {
  const { options, reverse } = await messageOptions(ChatMessage, { roomId }, query)
  const messages = await ChatMessage.findAll(options)
  return reverse ? messages.reverse() : messages
}

module.exports = { saveSupportMessage, saveSupportReply, listSupportChats, listSupportMessages }
