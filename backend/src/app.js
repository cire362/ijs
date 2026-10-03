const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const rateLimit = require('express-rate-limit')
const cookieParser = require('cookie-parser')
const path = require('path')
const crypto = require('crypto')
const authRoutes = require('./routes/auth')
const propertyRoutes = require('./routes/properties')
const applicationRoutes = require('./routes/applications')
const notificationRoutes = require('./routes/notifications')
const userRoutes = require('./routes/users')
const newsRoutes = require('./routes/news')
const eventsRoutes = require('./routes/events')
const addressRoutes = require('./routes/address')
const supportRoutes = require('./routes/support')
const tariffRoutes = require('./routes/tariffs')
const { getHttpCorsOptions } = require('./utils/cors')
const logger = require('./utils/logger')
const { requestPath } = require('./utils/requestPath')

const app = express()

app.set('trust proxy', require('./config/environment').trustedProxies())
app.disable('x-powered-by')
app.use(require('./ops/metrics').recordHttp)
app.use(cors(getHttpCorsOptions()))
app.use(
  helmet({
    // API also serves images from /uploads that are consumed by the frontend.
    // Avoid blocking cross-origin image loads.
    crossOriginResourcePolicy: false
  })
)

const apiLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Слишком много запросов, попробуйте позже' },
  skip: (req) => ['/health', '/health/live', '/health/ready', '/metrics', '/ops/status'].includes(req.path) || req.path.startsWith('/uploads') ||
    ['/auth/register', '/auth/login', '/auth/refresh', '/auth/logout', '/auth/logout-all', '/auth/password/forgot', '/auth/password/reset'].includes(req.path)
})

app.use((req, res, next) => {
  req.requestId = crypto.randomUUID()
  res.setHeader('x-request-id', req.requestId)

  const startedAt = process.hrtime.bigint()
  res.on('finish', () => {
    const elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1e6
    logger.info('http_request', {
      requestId: req.requestId,
      method: req.method,
      path: requestPath(req.originalUrl),
      statusCode: res.statusCode,
      durationMs: Math.round(elapsedMs * 100) / 100,
      ip: req.ip,
      userAgent: req.get('user-agent') || null
    })
  })

  next()
})

app.use(apiLimiter)
app.use(cookieParser())
app.use(express.json({ limit: '1mb' }))

app.use('/uploads/application_docs', require('./middleware/applicationDocument'))
app.use('/uploads/property_docs', require('./middleware/propertyDocument'))
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')))

app.use(require('./routes/operations').createOperationsRouter())
app.use((req, res, next) => {
  if (require('./ops/state').state.shuttingDown) return res.status(503).json({ error: 'Сервер завершает работу' })
  next()
})
app.use('/address', addressRoutes)
app.use('/auth', authRoutes)
app.use('/properties', propertyRoutes)
app.use('/applications', applicationRoutes)
app.use('/notifications', notificationRoutes)
app.use('/users', userRoutes)
app.use('/news', newsRoutes)
app.use('/events', eventsRoutes)
app.use('/support', supportRoutes)
app.use('/tariffs', tariffRoutes)
app.use('/audit', require('./routes/audit'))

app.use(require('./middleware/failedUpload'))
app.use((err, req, res, next) => {
  logger.error('request_failed', {
    requestId: req.requestId,
    method: req.method,
    path: requestPath(req.originalUrl),
    error: {
      name: err?.name,
      message: err?.message,
      stack: err?.stack
    }
  })

  if (res.headersSent) return next(err)
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Некорректный JSON' })
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Запрос превышает допустимый размер' })
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'Файл превышает допустимый размер' })
  if (err.name === 'MulterError') return res.status(400).json({ error: 'Проверьте количество файлов и имя поля загрузки' })
  if (err.name === 'SequelizeUniqueConstraintError') return res.status(409).json({ error: 'Запись с такими данными уже существует' })
  if (err.name === 'SequelizeForeignKeyConstraintError') return res.status(409).json({ error: 'Запись связана с другими данными или больше не существует' })

  if (err.status) {
    return res.status(err.status).json({ error: err.message })
  }

  // Sequelize Validation Error
  if (err.name === 'SequelizeValidationError') {
    return res
      .status(400)
      .json({ error: err.errors.map((e) => e.message).join(', ') })
  }

  // Postgres invalid integer (22P02)
  if (err.name === 'SequelizeDatabaseError' && err.parent?.code === '22P02') {
    return res.status(400).json({ error: 'Некорректный ID' })
  }

  res.status(500).json({ error: 'Внутренняя ошибка' })
})

module.exports = app
