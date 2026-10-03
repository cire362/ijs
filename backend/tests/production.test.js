const crypto = require('crypto')
const fs = require('fs/promises')
const path = require('path')
const os = require('os')
const express = require('express')
const request = require('supertest')
const { validateEnvironment } = require('../src/config/environment')
const { createProductionEnv } = require('../ops/configure')
const { createClientIpResolver } = require('../src/utils/clientIp')
const { createOperationsRouter } = require('../src/routes/operations')
const { state, jobsHealthy } = require('../src/ops/state')
const { startScheduledJobs } = require('../src/jobs/scheduler')
const { assess } = require('../ops/monitor')
const logger = require('../src/utils/logger')

const secret = () => crypto.randomBytes(32).toString('hex')
function production () {
  return {
    NODE_ENV: 'production',
    JWT_SECRET: secret(),
    REFRESH_TOKEN_SECRET: secret(),
    OPS_TOKEN: secret(),
    DATABASE_URL: `postgres://ijs_app:${secret()}@db:5432/ijshub`,
    APP_ORIGIN: 'https://app.ijshub.ru',
    TRUST_PROXY: '172.30.50.0/24'
  }
}
afterEach(() => { state.jobs.clear(); state.shuttingDown = false; jest.restoreAllMocks() })

test('production settings accept independent generated secrets and restricted proxies', () => {
  expect(validateEnvironment(production())).toMatchObject({ port: 4000, poolMax: 20, queryMs: 15000 })
})
test.each([
  ['JWT_SECRET', undefined], ['JWT_SECRET', 'change_me_to_a_very_long_secret_value'],
  ['REFRESH_TOKEN_SECRET', 'short'], ['OPS_TOKEN', 'a'.repeat(64)],
  ['DATABASE_URL', undefined], ['DATABASE_URL', 'postgres://postgres:postgres@db/ijshub'],
  ['APP_ORIGIN', 'http://app.ijshub.ru'], ['APP_ORIGIN', 'https://app.ijshub.ru/path'],
  ['APP_ORIGIN', 'https://example.com'], ['TRUST_PROXY', undefined], ['TRUST_PROXY', '1'],
  ['TRUST_PROXY', '0.0.0.0/0'], ['TRUST_PROXY', '::/0'], ['TRUST_PROXY', 'invalid-host'],
  ['COOKIE_SECURE', 'false'], ['RUN_SCHEDULED_JOBS', 'false'], ['WEB_CONCURRENCY', '2'],
  ['DB_POOL_MAX', '2'], ['DB_QUERY_TIMEOUT_MS', '0'], ['EVENT_TIME_ZONE', 'invalid'],
  ['ACCESS_TOKEN_TTL', '15'], ['REFRESH_TOKEN_DAYS', '0'], ['COOKIE_SAME_SITE', 'wrong']
])('production rejects unsafe %s=%s', (name, value) => {
  const env = production()
  env[name] = value
  expect(() => validateEnvironment(env)).toThrow()
})
test('secrets cannot be reused or padded with whitespace and errors do not reveal them', () => {
  const env = production()
  env.REFRESH_TOKEN_SECRET = env.JWT_SECRET
  expect(() => validateEnvironment(env)).toThrow('must differ')
  env.JWT_SECRET = ` ${secret()} `
  try { validateEnvironment(env); throw new Error('Expected failure') } catch (error) { expect(error.message).not.toContain(env.JWT_SECRET) }
})
test('configuration generator creates a private complete file and never overwrites it', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'ijs-env-test-'))
  const destination = path.join(directory, '.env.production')
  try {
    await createProductionEnv({ domain: 'app.ijshub.ru', mirrorPath: '/mnt/backup', destination })
    const content = await fs.readFile(destination, 'utf8')
    const env = require('dotenv').parse(content)
    validateEnvironment({ ...env, NODE_ENV: 'production', TRUST_PROXY: env.BACKEND_SUBNET })
    expect(new URL(env.DATABASE_URL).password).toBe(env.APP_DB_PASSWORD)
    expect((await fs.stat(destination)).mode & 0o777).toBe(0o600)
    await expect(createProductionEnv({ domain: 'app.ijshub.ru', mirrorPath: '/mnt/backup', destination })).rejects.toMatchObject({ code: 'EEXIST' })
    expect(await fs.readFile(destination, 'utf8')).toBe(content)
  } finally { await fs.rm(directory, { recursive: true, force: true }) }
})

function incoming (remote, forwarded) { return { socket: { remoteAddress: remote }, headers: forwarded ? { 'x-forwarded-for': forwarded } : {} } }
test('direct requests cannot spoof IP addresses using proxy headers', () => {
  const resolve = createClientIpResolver({})
  expect(resolve(incoming('::ffff:198.51.100.2', '203.0.113.9'))).toBe('198.51.100.2')
})
test('trusted proxy chains stop at the first untrusted hop', () => {
  const resolve = createClientIpResolver({ TRUST_PROXY: '172.30.50.0/24' })
  expect(resolve(incoming('172.30.50.3', '192.0.2.8, 203.0.113.9'))).toBe('203.0.113.9')
  expect(resolve(incoming('172.30.50.3', '203.0.113.9, 172.30.50.4'))).toBe('203.0.113.9')
  expect(resolve(incoming('198.51.100.2', '203.0.113.9'))).toBe('198.51.100.2')
})
test('IPv6 clients within one subnet share the configured rate limit bucket', () => {
  const resolve = createClientIpResolver({})
  expect(resolve(incoming('2001:db8:1234:5600::1'))).toBe(resolve(incoming('2001:db8:1234:56ff::2')))
})

function opsApp (options) { const app = express(); app.use(createOperationsRouter(options)); return app }
test.each(['database', 'storage', 'jobs'])('readiness fails when %s is unavailable while liveness remains available', async (unavailable) => {
  const app = opsApp({ probe: async () => { if (unavailable === 'database') throw new Error('secret DB error') }, storageProbe: async () => { if (unavailable === 'storage') throw new Error('disk error') }, healthyJobs: () => unavailable !== 'jobs' })
  expect((await request(app).get('/health/live')).status).toBe(200)
  const ready = await request(app).get('/health/ready')
  expect(ready.status).toBe(503)
  expect(ready.body.checks[unavailable]).toBe(false)
  expect(ready.headers['cache-control']).toBe('no-store')
  expect(JSON.stringify(ready.body)).not.toContain('secret')
})
test('readiness recovers after a failed probe and fails during shutdown', async () => {
  const probe = jest.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue()
  const app = opsApp({ probe, storageProbe: async () => {}, healthyJobs: () => true })
  expect((await request(app).get('/health')).status).toBe(503)
  expect((await request(app).get('/health')).status).toBe(200)
  state.shuttingDown = true
  expect((await request(app).get('/health')).body.status).toBe('shutting_down')
  expect((await request(app).get('/health/live')).status).toBe(200)
})
test('metrics and operational status require a separate bearer token', async () => {
  const original = process.env.OPS_TOKEN
  process.env.OPS_TOKEN = secret()
  try {
    const app = opsApp({})
    expect((await request(app).get('/metrics')).status).toBe(401)
    expect((await request(app).get('/ops/status').set('Authorization', 'Bearer wrong')).status).toBe(401)
    const response = await request(app).get('/metrics').set('Authorization', `Bearer ${process.env.OPS_TOKEN}`)
    expect(response.status).toBe(200)
    expect(response.text).toContain('ijs_process_rss_bytes')
    expect(response.text).not.toContain(process.env.OPS_TOKEN)
    const status = await request(app).get('/ops/status').set('Authorization', `Bearer ${process.env.OPS_TOKEN}`)
    expect(status.status).toBe(200)
    expect(status.body.queues).toEqual({ pendingFiles: expect.any(Number), overdueReminders: expect.any(Number), stuckFiles: expect.any(Number) })
  } finally { if (original == null) delete process.env.OPS_TOKEN; else process.env.OPS_TOKEN = original }
})
test('shutdown waits for a running job and starts no further jobs', async () => {
  let finish
  const job = jest.fn(() => new Promise(resolve => { finish = resolve }))
  const stop = startScheduledJobs([{ name: 'test-drain', job, intervalMs: 5, runImmediately: true }], { log () {}, error () {} }, { enabled: true })
  await new Promise(resolve => setImmediate(resolve))
  let stopped = false
  const pending = stop().then(() => { stopped = true })
  await new Promise(resolve => setTimeout(resolve, 20))
  expect(stopped).toBe(false)
  expect(job).toHaveBeenCalledTimes(1)
  finish({})
  await pending
  expect(stopped).toBe(true)
  expect(state.jobs.get('test-drain').running).toBe(false)
})
test('repeated job failures and missed runs fail readiness, a single failure is tolerated', async () => {
  let succeeded
  const recovered = new Promise(resolve => { succeeded = resolve })
  let calls = 0
  const job = jest.fn().mockImplementation(async () => {
    calls++
    if (calls <= 3) throw new Error('Failure')
    succeeded()
    return {}
  })
  const stop = startScheduledJobs([{ name: 'retry', job, intervalMs: 25, runImmediately: true }], { log () {}, error () {} }, { enabled: true })
  try {
    await new Promise(resolve => setImmediate(resolve))
    expect(state.jobs.get('retry').consecutiveFailures).toBe(1)
    expect(jobsHealthy()).toBe(true)
    while (state.jobs.get('retry').consecutiveFailures < 3) await new Promise(resolve => setTimeout(resolve, 5))
    expect(jobsHealthy()).toBe(false)
    await recovered
    await new Promise(resolve => setImmediate(resolve))
    expect(jobsHealthy()).toBe(true)
    expect(jobsHealthy(Date.now() + 120001)).toBe(false)
    expect(state.jobs.get('retry').failures).toBe(3)
  } finally { await stop() }
})
test('monitor detects failed, stale, unmirrored backups and blocked queues', () => {
  const health = { ok: true }
  const operations = { queues: { overdueReminders: 0, stuckFiles: 0 } }
  expect(assess(health, operations, { lastSuccessAt: new Date().toISOString(), mirrored: true })).toEqual([])
  expect(assess(health, operations, { lastSuccessAt: 'invalid' })).toContain('backup_stale')
  expect(assess({ ok: false }, { queues: { overdueReminders: 1, stuckFiles: 1 } }, { lastSuccessAt: new Date(Date.now() - 27 * 3600000).toISOString(), mirrored: false, lastError: 'backup_failed' })).toEqual(['api_not_ready', 'overdue_reminders', 'stuck_file_deletions', 'backup_stale', 'backup_not_mirrored', 'backup_failed'])
})
test('backup configuration failure is recorded immediately for monitoring', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'ijs-bad-backup-'))
  try {
    await expect(require('../ops/backup').createBackup({ databaseUrl: process.env.TEST_DATABASE_URL, backupDir: directory, key: Buffer.alloc(4) })).rejects.toThrow('32-byte key')
    const status = JSON.parse(await fs.readFile(path.join(directory, 'status.json'), 'utf8'))
    expect(status.lastError).toBe('backup_failed')
    expect(assess({ ok: true }, {}, status)).toContain('backup_failed')
  } finally { await fs.rm(directory, { recursive: true, force: true }) }
})
test('structured logs redact nested credentials and database URLs', () => {
  const write = jest.spyOn(process.stderr, 'write').mockImplementation(() => true)
  const circular = {}; circular.self = circular
  logger.error('failure', { nested: { authorization: 'hidden-auth', password: 'hidden-password' }, error: new Error('postgres://user:hidden-pass@db/ijshub'), circular })
  const line = write.mock.calls[0][0]
  expect(line).not.toMatch(/hidden-/)
  expect(JSON.parse(line).meta.nested.authorization).toBe('[redacted]')
  expect(line).toContain('[circular]')
})
