const { sequelize } = require('../src/db')
require('../src/models')
const { runPendingMigrations, getMigrationStatus } = require('../src/db/migrator')
const { syncAndTruncateExcept } = require('./testDb')
const MIGRATION_COUNT = require('fs').readdirSync(require('path').join(__dirname, '../src/db/migrations')).filter((name) => name.endsWith('.js')).length

beforeAll(async () => {
  await syncAndTruncateExcept(sequelize)
  await getMigrationStatus()
})

afterAll(async () => sequelize.close())

test('simultaneous startup processes apply and record a migration exactly once', async () => {
  await sequelize.query('DELETE FROM "SequelizeMeta"')
  const results = await Promise.all([runPendingMigrations(), runPendingMigrations()])
  expect(results.flat()).toHaveLength(MIGRATION_COUNT)
  const [rows] = await sequelize.query('SELECT name FROM "SequelizeMeta"')
  expect(rows).toHaveLength(MIGRATION_COUNT)
  expect((await getMigrationStatus()).every((migration) => migration.applied)).toBe(true)
  expect(await runPendingMigrations()).toEqual([])
})

test('a failed migration releases its database lock and is not recorded', async () => {
  await sequelize.query('DELETE FROM "SequelizeMeta"')
  const migration = require('../src/db/migrations/20260311T000001-initial-schema')
  const spy = jest.spyOn(migration, 'up').mockRejectedValueOnce(new Error('migration failed'))
  try {
    await expect(runPendingMigrations()).rejects.toThrow('migration failed')
    expect((await getMigrationStatus()).some((entry) => entry.applied)).toBe(false)
    expect(await runPendingMigrations()).toHaveLength(MIGRATION_COUNT)
  } finally {
    spy.mockRestore()
  }
})

test('adopting a compatible legacy schema preserves existing users', async () => {
  const { User } = require('../src/models')
  const user = await User.create({ email: 'migration-preserve@test.com', passwordHash: 'fixture', role: 'agent' })
  await sequelize.query('DELETE FROM "SequelizeMeta"')
  expect(await runPendingMigrations()).toHaveLength(MIGRATION_COUNT)
  expect((await User.findByPk(user.id)).email).toBe(user.email)
})

test('a partial or incompatible schema fails without recording the baseline', async () => {
  const migration = require('../src/db/migrations/20260311T000001-initial-schema')
  await expect(sequelize.transaction(async (transaction) => {
    await sequelize.query('ALTER TABLE properties ALTER COLUMN city TYPE VARCHAR(199)', { transaction })
    await migration.up({ sequelize, transaction })
  })).rejects.toThrow('Existing schema differs at properties.city')
})

test('legacy adoption checks relational constraints as well as columns', async () => {
  const migration = require('../src/db/migrations/20260311T000001-initial-schema')
  const [keys] = await sequelize.query("SELECT conname FROM pg_constraint WHERE conrelid='applications'::regclass AND contype='f' AND confrelid='users'::regclass")
  await expect(sequelize.transaction(async (transaction) => {
    await sequelize.query(`ALTER TABLE applications DROP CONSTRAINT "${keys[0].conname.replace(/"/g, '""')}"`, { transaction })
    await migration.up({ sequelize, transaction })
  })).rejects.toThrow('Existing schema lacks a baseline constraint on applications(agent_id)')
})

test('legacy adoption refuses missing registration uniqueness', async () => {
  const migration = require('../src/db/migrations/20260311T000001-initial-schema')
  await expect(sequelize.transaction(async (transaction) => {
    await sequelize.query('DROP INDEX event_registrations_event_id_agent_id', { transaction })
    await migration.up({ sequelize, transaction })
  })).rejects.toThrow('Existing schema lacks unique index event_registrations_event_id_agent_id')
})
