require('dotenv').config()

const http = require('http')
const config = require('./config/environment').validateEnvironment()
const { state } = require('./ops/state')
const { sequelize } = require('./db')
const app = require('./app')
const { expireSentApplications } = require('./jobs/applicationExpiry')
const { sendEventReminders } = require('./jobs/eventReminders')
const { startScheduledJobs } = require('./jobs/scheduler')
const { runPendingMigrations } = require('./db/migrator')
const logger = require('./utils/logger')

function dbInfo () {
  const cfg = sequelize?.config
  if (!cfg) return '(unknown)'
  const host = cfg.host || 'localhost'
  const port = cfg.port || 5432
  const db = cfg.database || '(db)'
  const user = cfg.username || '(user)'
  return `postgres://${user}:***@${host}:${port}/${db}`
}

const port = config.port
const server = http.createServer(app)
server.requestTimeout = 120000
server.headersTimeout = 15000
server.keepAliveTimeout = 5000
server.maxRequestsPerSocket = 1000
const io = require('./realtime').createRealtimeServer(server)

let stopScheduledJobs = () => {}
let shuttingDown = false

async function bootstrap () {
  try {
    await sequelize.authenticate()
    if (process.env.NODE_ENV === 'production') {
      const [roles] = await sequelize.query('SELECT rolsuper, rolcreatedb, rolcreaterole FROM pg_roles WHERE rolname=current_user')
      if (roles[0].rolsuper || roles[0].rolcreatedb || roles[0].rolcreaterole) throw new Error('The production API database role must not be a superuser or create roles/databases')
    }
    await require('fs/promises').access(require('path').join(__dirname, '../uploads/.restore-in-progress')).then(() => { throw new Error('Uploads restore is incomplete') }, error => { if (error.code !== 'ENOENT') throw error })
    const appliedMigrations = await runPendingMigrations()

    logger.info('db_connected', { database: dbInfo() })
    if (appliedMigrations.length > 0) {
      logger.info('migrations_applied', { appliedMigrations })
    }

    stopScheduledJobs = startScheduledJobs(
      [
        {
          name: 'expire-sent-applications',
          runImmediately: true,
          intervalMs: 60 * 1000,
          job: expireSentApplications
        },
        {
          name: 'send-event-reminders',
          runImmediately: true,
          intervalMs: 60 * 1000,
          job: sendEventReminders
        },
        {
          name: 'cleanup-files',
          intervalMs: 60000,
          runImmediately: true,
          job: require('./jobs/fileCleanup').cleanupFiles
        },
        {
          name: 'geocode-properties',
          intervalMs: 10 * 60 * 1000,
          runImmediately: true,
          job: require('./jobs/geocodeProperties').geocodeMissingProperties
        },
        {
          name: 'cleanup-auth-sessions',
          intervalMs: 60 * 60 * 1000,
          runImmediately: true,
          job: require('./jobs/sessionCleanup').cleanupAuthSessions
        }
      ],
      logger
    )

    server.listen(port, () => {
      logger.info('api_listening', { port: Number(port) })
    })
  } catch (err) {
    logger.error('server_start_failed', err)
    process.exit(1)
  }
}

async function shutdown (signal) {
  if (shuttingDown) return
  shuttingDown = true

  logger.info('shutdown_started', { signal })
  state.shuttingDown = true
  const jobsStopped = stopScheduledJobs()

  const forceExitTimer = setTimeout(() => {
    logger.error('shutdown_timed_out')
    process.exit(1)
  }, config.shutdownMs)
  forceExitTimer.unref?.()

  try {
    await new Promise((resolve) => {
      io.close(() => resolve())
    })

    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error && error.code !== 'ERR_SERVER_NOT_RUNNING') {
          reject(error)
          return
        }
        resolve()
      })
    })

    await jobsStopped
    await Promise.allSettled([...io.pendingOperations])
    await sequelize.close()
    clearTimeout(forceExitTimer)
    process.exit(0)
  } catch (error) {
    logger.error('shutdown_failed', error)
    process.exit(1)
  }
}

process.on('SIGTERM', () => {
  shutdown('SIGTERM').catch((error) => {
    logger.error('shutdown_signal_failed', { signal: 'SIGTERM', error })
  })
})

process.on('SIGINT', () => {
  shutdown('SIGINT').catch((error) => {
    logger.error('shutdown_signal_failed', { signal: 'SIGINT', error })
  })
})

bootstrap()
