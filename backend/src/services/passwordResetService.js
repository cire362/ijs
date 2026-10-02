const bcrypt = require('bcryptjs')
const { sequelize } = require('../db')
const { User, AuthSession, PasswordResetToken } = require('../models')
const { hashToken, randomToken } = require('../utils/authTokens')
const { isMailConfigured, sendMailInBackground } = require('../utils/mailer')
const { disconnectSessions } = require('../socket')

const RESET_TTL_MINUTES = 60

function appOrigin () {
  const origin = process.env.APP_ORIGIN || String(process.env.CORS_ALLOWED_ORIGINS || '').split(',')[0] || 'http://localhost:5173'
  return origin.trim().replace(/\/$/, '')
}

// The token travels in the URL fragment, so it never reaches server or proxy access logs.
function resetLink (token) {
  return `${appOrigin()}/reset-password#token=${encodeURIComponent(token)}`
}

function resetMessage (user, token) {
  const link = resetLink(token)
  return {
    to: user.email,
    subject: 'Восстановление пароля — ИЖС Hub',
    text: [
      'Здравствуйте!',
      '',
      'Мы получили запрос на смену пароля для вашего аккаунта ИЖС Hub.',
      `Чтобы задать новый пароль, перейдите по ссылке (действует ${RESET_TTL_MINUTES} минут):`,
      link,
      '',
      'Если вы не запрашивали смену пароля, просто проигнорируйте это письмо: пароль останется прежним.'
    ].join('\n'),
    html: `<p>Здравствуйте!</p><p>Мы получили запрос на смену пароля для вашего аккаунта ИЖС Hub.</p>
<p><a href="${link}">Задать новый пароль</a> (ссылка действует ${RESET_TTL_MINUTES} минут).</p>
<p>Если вы не запрашивали смену пароля, просто проигнорируйте это письмо: пароль останется прежним.</p>`
  }
}

function changedMessage (user) {
  return {
    to: user.email,
    subject: 'Пароль изменён — ИЖС Hub',
    text: 'Пароль вашего аккаунта ИЖС Hub изменён, все сеансы завершены. Если это были не вы, срочно восстановите пароль и обратитесь в поддержку.'
  }
}

class PasswordResetService {
  // Always answers the same way, whether or not the email exists.
  async requestReset (email, { ip } = {}) {
    if (!isMailConfigured()) {
      throw { status: 503, message: 'Восстановление пароля временно недоступно. Обратитесь в поддержку' }
    }
    const emailNorm = String(email || '').trim().toLowerCase()
    const user = await User.findOne({ where: { email: emailNorm, deletedAt: null } })
    if (!user || user.developerRejected) return
    const token = randomToken(32)
    await sequelize.transaction(async (transaction) => {
      // A new request invalidates earlier links.
      await PasswordResetToken.update(
        { usedAt: new Date() },
        { where: { userId: user.id, usedAt: null }, transaction }
      )
      await PasswordResetToken.create({
        userId: user.id,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + RESET_TTL_MINUTES * 60000),
        ip: ip || null
      }, { transaction })
      transaction.afterCommit(() => sendMailInBackground(resetMessage(user, token)))
    })
  }

  async resetPassword (token, password) {
    const passwordHash = await bcrypt.hash(password, 10)
    const invalid = { status: 400, message: 'Ссылка для смены пароля недействительна или устарела. Запросите новую' }
    const user = await sequelize.transaction(async (transaction) => {
      const existing = await PasswordResetToken.findOne({ where: { tokenHash: hashToken(token) }, transaction })
      if (!existing) throw invalid
      // Lock the user before the token, as login and password changes do.
      const user = await User.findByPk(existing.userId, { transaction, lock: transaction.LOCK.UPDATE })
      const reset = await PasswordResetToken.findByPk(existing.id, { transaction, lock: transaction.LOCK.UPDATE })
      if (!user || user.deletedAt || user.developerRejected || !reset || reset.usedAt || reset.expiresAt <= new Date()) throw invalid
      await user.update({ passwordHash }, { transaction })
      await PasswordResetToken.update({ usedAt: new Date() }, { where: { userId: user.id, usedAt: null }, transaction })
      // Whoever knew the old password loses access.
      const sessions = await AuthSession.findAll({ where: { userId: user.id }, attributes: ['id'], transaction })
      await AuthSession.destroy({ where: { userId: user.id }, transaction })
      transaction.afterCommit(() => disconnectSessions(sessions.map((session) => session.id)))
      return user
    })
    sendMailInBackground(changedMessage(user))
  }
}

module.exports = new PasswordResetService()
module.exports.resetLink = resetLink
