const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')

const { User, AuthSession, Notification } = require('../models')
const { formatRuPhone } = require('../utils/phone')
const {
  hashToken,
  randomToken,
  accessTtl,
  refreshTtlMs,
  setAuthCookies,
  clearAuthCookies
} = require('../utils/authTokens')
const { sequelize } = require('../db')
const { getJwtSecret } = require('../utils/secrets')

const jwtSecret = getJwtSecret()
const { assertUniqueIdentity } = require('../utils/userIdentity')
const { disconnectSessions } = require('../socket')

function toUserPayload (user) {
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
    avatarUrl: user.avatarUrl,
    legalConsentAcceptedAt: user.legalConsentAcceptedAt,
    legalConsentVersion: user.legalConsentVersion,
    marketingConsentGiven: Boolean(user.marketingConsentGiven),
    marketingConsentAcceptedAt: user.marketingConsentAcceptedAt,
    marketingConsentWithdrawnAt: user.marketingConsentWithdrawnAt,
    marketingConsentVersion: user.marketingConsentVersion
  }
}

// Comparing against a fixed hash keeps the response time independent of whether the email exists.
const DUMMY_PASSWORD_HASH = bcrypt.hashSync('timing-equalizer', 10)

function issueAccessToken (user, sessionId) {
  return jwt.sign({ sub: user.id, role: user.role, sid: sessionId }, jwtSecret, {
    expiresIn: accessTtl()
  })
}

class AuthService {
  async register (data) {
    const {
      firstName,
      lastName,
      middleName,
      name,
      email,
      phone,
      password,
      role,
      companyName,
      consent
    } = data

    const emailNorm = email.trim().toLowerCase()
    const phoneNorm = formatRuPhone(phone)

    if (!phoneNorm) {
      throw {
        status: 400,
        message:
          'Некорректный телефон (пример: +7 900 100-00-11 или 8 900 100-00-11)'
      }
    }

    const passwordHash = await bcrypt.hash(password, 10)

    let derivedLastName = lastName
    let derivedFirstName = firstName
    let derivedMiddleName = middleName
    if ((!derivedLastName || !derivedFirstName) && typeof name === 'string') {
      const parts = name.trim().split(/\s+/).filter(Boolean)
      derivedLastName = derivedLastName || parts[0]
      derivedFirstName = derivedFirstName || parts[1]
      derivedMiddleName = derivedMiddleName || parts.slice(2).join(' ')
    }

    const legalConsentAcceptedAt = consent?.legal?.acceptedAt
      ? new Date(consent.legal.acceptedAt)
      : new Date()

    const normalizedCompanyName = String(companyName || '').trim()
    if (['agent', 'developer'].includes(role) && !normalizedCompanyName) {
      throw { status: 400, message: 'Укажите компанию' }
    }

    const marketingAccepted = Boolean(consent?.marketing?.accepted)
    const marketingConsentAcceptedAt = marketingAccepted
      ? consent?.marketing?.acceptedAt
        ? new Date(consent.marketing.acceptedAt)
        : new Date()
      : null

    return sequelize.transaction(async (transaction) => {
      await assertUniqueIdentity({ email: emailNorm, phone: phoneNorm, transaction })
      const user = await User.create(
        {
          name: name || null,
          firstName: derivedFirstName || null,
          lastName: derivedLastName || null,
          middleName: derivedMiddleName || null,
          email: emailNorm,
          phone: phoneNorm,
          passwordHash,
          role,
          companyName:
            role === 'individual' ? null : normalizedCompanyName || null,
          developerApproved: role !== 'developer',

          legalConsentAcceptedAt,
          legalConsentVersion: consent?.legal?.documentVersion || null,
          legalConsentMeta: {
            termsPath: consent?.legal?.termsPath || null,
            privacyPath: consent?.legal?.privacyPath || null
          },

          marketingConsentGiven: marketingAccepted,
          marketingConsentAcceptedAt,
          marketingConsentWithdrawnAt: marketingAccepted ? null : new Date(),
          marketingConsentVersion: consent?.marketing?.documentVersion || null
        },
        { transaction }
      )

      if (role === 'developer') {
        const admins = await User.findAll({
          where: { role: 'admin', deletedAt: null },
          transaction
        })
        if (admins.length) {
          const display =
            user.companyName ||
            [user.lastName, user.firstName, user.middleName]
              .filter(Boolean)
              .join(' ') ||
            user.email
          await Notification.bulkCreate(
            admins.map((a) => ({
              userId: a.id,
              type: 'developer_registration',
              text: `Новая регистрация застройщика: ${display}`,
              meta: {
                developerId: user.id,
                email: user.email,
                companyName: user.companyName
              }
            })),
            { transaction }
          )
        }
      }

      return { id: user.id, email: user.email, role: user.role }
    })
  }

  async login (email, password, { req, res }) {
    const emailNorm = email.trim().toLowerCase()
    const existing = await User.findOne({ where: { email: emailNorm, deletedAt: null } })
    const matches = await bcrypt.compare(password, existing?.passwordHash || DUMMY_PASSWORD_HASH)
    if (!existing || !matches) {
      throw { status: 401, message: 'Неверный email или пароль' }
    }
    const refreshToken = randomToken(48)
    const csrfToken = randomToken(24)
    const result = await sequelize.transaction(async (transaction) => {
      const user = await User.findByPk(existing.id, { transaction, lock: transaction.LOCK.UPDATE })
      if (!user || user.deletedAt || (user.passwordHash !== existing.passwordHash && !(await bcrypt.compare(password, user.passwordHash)))) {
        throw { status: 401, message: 'Неверный email или пароль' }
      }
      if (user.developerRejected) throw { status: 403, message: 'Регистрация застройщика отклонена' }
      const session = await AuthSession.create({
        userId: user.id,
        refreshTokenHash: hashToken(refreshToken),
        expiresAt: new Date(Date.now() + refreshTtlMs()),
        ip: req.ip || null,
        userAgent: req.get('user-agent')?.slice(0, 255) || null
      }, { transaction })
      return { token: issueAccessToken(user, session.id), user: toUserPayload(user) }
    })
    setAuthCookies(res, { refreshToken, csrfToken }, req)
    return result
  }

  async refresh (cookies, { req, res }) {
    const hashed = cookies.refresh_token ? hashToken(cookies.refresh_token) : null
    const existing = hashed ? await AuthSession.findOne({ where: { refreshTokenHash: hashed } }) : null
    if (!existing) {
      throw { status: 401, message: 'Сессия недействительна. Войдите снова' }
    }
    const result = await sequelize.transaction(async (transaction) => {
      // Lock user before session, as login/password changes/logout-all do.
      const user = await User.findByPk(existing.userId, { transaction, lock: transaction.LOCK.UPDATE })
      const session = await AuthSession.findOne({
        where: { refreshTokenHash: hashed }, transaction, lock: transaction.LOCK.UPDATE
      })
      if (!session) return { invalid: true, rotated: true }
      if (!user || user.deletedAt || user.developerRejected || session.revokedAt || session.expiresAt <= new Date()) {
        await session.destroy({ transaction })
        return { invalid: true }
      }
      const refreshToken = randomToken(48)
      await session.update({
        refreshTokenHash: hashToken(refreshToken),
        expiresAt: new Date(Date.now() + refreshTtlMs()),
        ip: req.ip || session.ip,
        userAgent: req.get('user-agent')?.slice(0, 255) || session.userAgent
      }, { transaction })
      return { token: issueAccessToken(user, session.id), user: toUserPayload(user), refreshToken }
    })
    if (result.invalid) {
      // A parallel refresh must not erase cookies set by the successful request.
      if (!result.rotated) clearAuthCookies(res, req)
      throw { status: 401, message: 'Сессия истекла. Войдите снова' }
    }
    setAuthCookies(res, { refreshToken: result.refreshToken, csrfToken: randomToken(24) }, req)
    return { token: result.token, user: result.user }
  }

  async logout (cookies, { req, res }) {
    if (cookies.refresh_token) {
      const session = await AuthSession.findOne({ where: { refreshTokenHash: hashToken(cookies.refresh_token) } })
      if (session) {
        await session.destroy()
        disconnectSessions([session.id])
      }
    }
    clearAuthCookies(res, req)
  }

  async logoutAll (cookies, { req, res }) {
    const hashed = cookies.refresh_token ? hashToken(cookies.refresh_token) : null
    const existing = hashed ? await AuthSession.findOne({ where: { refreshTokenHash: hashed } }) : null
    if (!existing) {
      clearAuthCookies(res, req)
      throw { status: 401, message: 'Сессия недействительна' }
    }
    await sequelize.transaction(async (transaction) => {
      await User.findByPk(existing.userId, { transaction, lock: transaction.LOCK.UPDATE })
      const session = await AuthSession.findOne({ where: { refreshTokenHash: hashed }, transaction })
      if (!session || session.expiresAt <= new Date() || session.revokedAt) {
        throw { status: 401, message: 'Сессия недействительна' }
      }
      const sessions = await AuthSession.findAll({ where: { userId: session.userId }, attributes: ['id'], transaction })
      await AuthSession.destroy({ where: { userId: session.userId }, transaction })
      transaction.afterCommit(() => disconnectSessions(sessions.map((entry) => entry.id)))
    })
    clearAuthCookies(res, req)
  }
}

module.exports = new AuthService()
