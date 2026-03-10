process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_secret'
process.env.NODE_ENV = 'test'
process.env.TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  'postgres://postgres:123@localhost:5432/ijshub_test'

beforeAll(async () => {
  // Best-effort: create dedicated test DB if missing.
  // This avoids tests touching dev/prod DB and prevents accidental data loss.
  const { Client } = require('pg')
  const { URL } = require('url')

  const cs = process.env.TEST_DATABASE_URL
  if (!cs) return

  let u
  try {
    u = new URL(cs)
  } catch {
    return
  }

  const dbName = String(u.pathname || '').replace(/^\//, '')
  if (!dbName) return
  if (!dbName.toLowerCase().endsWith('_test')) return

  const admin = new URL(cs)
  admin.pathname = '/postgres'

  const client = new Client({ connectionString: admin.toString() })
  try {
    await client.connect()
    const exists = await client.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [dbName]
    )
    if (exists.rowCount === 0) {
      // Quote identifier safely (double quotes inside name are doubled)
      const ident = `"${dbName.replace(/"/g, '""')}"`
      await client.query(`CREATE DATABASE ${ident}`)
    }
  } catch (err) {
    // If the user doesn't have permissions, tests will fail later with a clear error.
    // We don't throw here to avoid masking the original connection issue.
  } finally {
    try {
      await client.end()
    } catch {
      // ignore
    }
  }
})
