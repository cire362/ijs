const { getSessionUser } = require('../utils/sessionUser')

function bearerToken (req) {
  const match = /^Bearer (\S+)$/i.exec(req.headers.authorization || '')
  return match?.[1] || null
}

const optionalAuthenticate = async (req, res, next) => {
  const token = bearerToken(req)
  if (!token) return next()
  try {
    const session = await getSessionUser(token)
    if (session) {
      req.user = session.user
      req.authSessionId = session.sessionId
    }
    next()
  } catch (error) { next(error) }
}

const authenticate = async (req, res, next) => {
  const token = bearerToken(req)
  if (!token) return res.status(401).json({ error: 'Токен отсутствует' })
  try {
    const session = await getSessionUser(token)
    if (!session) return res.status(401).json({ error: 'Сессия недействительна. Войдите снова' })
    req.user = session.user
    req.authSessionId = session.sessionId
    next()
  } catch (error) { next(error) }
}

const allowRoles =
  (...roles) =>
    (req, res, next) => {
      if (!req.user || !roles.includes(req.user.role)) {
        return res.status(403).json({ error: 'Доступ запрещён' })
      }

      if (
        req.user.role === 'developer' &&
      roles.includes('developer') &&
      req.user.developerApproved === false
      ) {
        return res.status(403).json({
          error: 'Аккаунт застройщика требует подтверждения администратора'
        })
      }
      next()
    }

module.exports = { authenticate, optionalAuthenticate, allowRoles, bearerToken }
