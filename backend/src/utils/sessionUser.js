const jwt = require('jsonwebtoken')
const { Op } = require('sequelize')
const { User, AuthSession } = require('../models')
const { getJwtSecret } = require('./secrets')
const { hashToken } = require('./authTokens')

// One query loads an active session together with its user.
async function findActiveSession (where) {
  const session = await AuthSession.findOne({
    where: { ...where, revokedAt: null, expiresAt: { [Op.gt]: new Date() } },
    include: [{ model: User, required: true }]
  })
  if (!session || session.user.developerRejected || session.user.deletedAt) return null
  return { user: session.user, sessionId: session.id, sessionExpiresAt: session.expiresAt }
}

async function getRefreshSessionUser (token) {
  if (typeof token !== 'string' || !token) return null
  return findActiveSession({ refreshTokenHash: hashToken(token) })
}

async function getActiveSession (sessionId) {
  if (!Number.isInteger(sessionId)) return null
  return findActiveSession({ id: sessionId })
}

// `expiredSessionId` accepts an expired access token only for that already authenticated session:
// a long-lived socket keeps working while its server session stays active.
async function getSessionUser (token, { expiredSessionId } = {}) {
  if (typeof token !== 'string' || !token) return null
  let payload
  try {
    payload = jwt.verify(token, getJwtSecret(), { algorithms: ['HS256'], ignoreExpiration: Boolean(expiredSessionId) })
  } catch {
    return null
  }
  if (!Number.isInteger(payload.sub) || !Number.isInteger(payload.sid) || !Number.isInteger(payload.exp)) return null
  const expired = payload.exp * 1000 <= Date.now()
  if (expired && payload.sid !== expiredSessionId) return null
  const session = await findActiveSession({ id: payload.sid, userId: payload.sub })
  if (!session) return null
  return { ...session, expiresAt: new Date(Math.min(session.sessionExpiresAt.getTime(), payload.exp * 1000)) }
}

module.exports = { getSessionUser, getRefreshSessionUser, getActiveSession }
