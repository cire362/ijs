const path = require('path')
const { ApplicationChatMessage, Application } = require('../models')
const { getSessionUser, getRefreshSessionUser } = require('../utils/sessionUser')
const { bearerToken } = require('./auth')
const { canAccessApplicationChat } = require('../services/applicationChatService')

// Browser download links use the HttpOnly session cookie; API clients may use Bearer.
module.exports = async function applicationDocument (req, res, next) {
  try {
    const session = req.get('authorization')
      ? await getSessionUser(bearerToken(req))
      : await getRefreshSessionUser(req.cookies?.refresh_token)
    if (!session) return res.status(401).json({ error: 'Войдите для скачивания документа' })
    let filename
    try {
      filename = decodeURIComponent(req.path).slice(1)
    } catch {
      return res.status(400).json({ error: 'Некорректный путь документа' })
    }
    if (!filename || filename.includes('\\') || filename !== path.basename(filename)) {
      return res.status(404).json({ error: 'Документ не найден' })
    }
    const message = await ApplicationChatMessage.findOne({
      where: { attachmentUrl: `/uploads/application_docs/${filename}` },
      include: [{ model: Application }]
    })
    if (!message) return res.status(404).json({ error: 'Документ не найден' })
    if (!canAccessApplicationChat(message.application, session.user)) {
      return res.status(403).json({ error: 'Доступ к документу запрещён' })
    }
    res.setHeader('Cache-Control', 'private, no-store')
    res.attachment(message.attachmentOriginalName || filename)
    next()
  } catch (error) {
    next(error)
  }
}
