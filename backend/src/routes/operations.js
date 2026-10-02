const crypto = require('crypto')
const express = require('express')
const fs = require('fs/promises')
const path = require('path')
const { Client } = require('pg')
const { databaseUrl } = require('../config/environment')
const { state, jobsHealthy } = require('../ops/state')
const { metricsText } = require('../ops/metrics')
const asyncHandler = require('../utils/asyncHandler')
const { bearerToken } = require('../middleware/auth')

function createOperationsRouter ({ probe, storageProbe, stateRef = state, healthyJobs = jobsHealthy } = {}) {
  const router = express.Router()
  let pending
  probe = probe || (async () => {
    const client = new Client({ connectionString: databaseUrl(), connectionTimeoutMillis: 1000, query_timeout: 1000, statement_timeout: 1000 })
    try { await client.connect(); await client.query('SELECT 1') } finally { await client.end().catch(() => {}) }
  })
  storageProbe = storageProbe || (async () => {
    const root = path.resolve(__dirname, '../../uploads')
    await fs.access(root, fs.constants.R_OK | fs.constants.W_OK)
    try { await fs.access(path.join(root, '.restore-in-progress')); throw new Error('Restoring') } catch (error) { if (error.code !== 'ENOENT') throw error }
  })
  router.get('/health/live', (req, res) => res.json({ ok: true }))
  const readiness = asyncHandler(async (req, res) => {
    res.set('Cache-Control', 'no-store')
    if (stateRef.shuttingDown) return res.status(503).json({ ok: false, status: 'shutting_down' })
    if (!pending) {
      pending = Promise.allSettled([probe(), storageProbe()])
      pending.finally(() => { pending = null })
    }
    const checks = await pending
    const database = checks[0].status === 'fulfilled'
    const storage = checks[1].status === 'fulfilled'
    const jobs = healthyJobs()
    const ok = database && storage && jobs && !stateRef.shuttingDown
    res.status(ok ? 200 : 503).json({ ok, checks: { database, storage, jobs } })
  })
  router.get(['/health', '/health/ready'], readiness)
  const authorize = (req, res, next) => {
    const expected = process.env.OPS_TOKEN
    const supplied = bearerToken(req)
    if (!expected) return res.sendStatus(404)
    if (!supplied || Buffer.byteLength(supplied) !== Buffer.byteLength(expected) || !crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) return res.sendStatus(401)
    res.set('Cache-Control', 'no-store')
    next()
  }
  router.get('/metrics', authorize, (req, res) => res.type('text/plain; version=0.0.4').send(metricsText()))
  router.get('/ops/status', authorize, asyncHandler(async (req, res) => {
    const { sequelize } = require('../db')
    const [rows] = await sequelize.query(`SELECT
      (SELECT count(*)::int FROM file_deletions) AS "pendingFiles",
      (SELECT count(*)::int FROM event_reminders WHERE status='pending' AND due_at < now() - INTERVAL '5 minutes') AS "overdueReminders",
      (SELECT count(*)::int FROM file_deletions WHERE created_at < now() - INTERVAL '1 hour') AS "stuckFiles"`)
    res.json({ uptimeSeconds: Math.floor(process.uptime()), jobs: Object.fromEntries(stateRef.jobs), queues: rows[0] })
  }))
  return router
}

module.exports = { createOperationsRouter }
