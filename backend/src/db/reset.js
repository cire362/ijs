const { sequelize } = require('../db')
const { runPendingMigrations } = require('./migrator')

function assertResetAllowed (env = process.env, database = sequelize.config.database) {
  if (env.NODE_ENV === 'production') throw new Error('Refusing to reset a production database')
  if (!['development', 'test'].includes(env.NODE_ENV) || env.ALLOW_DB_RESET !== '1' || env.RESET_DATABASE_NAME !== database) {
    throw new Error('Database reset requires NODE_ENV=development or test, ALLOW_DB_RESET=1 and RESET_DATABASE_NAME matching the database exactly')
  }
}

async function resetDatabase () {
  assertResetAllowed()
  // Drop the schema and migration ledger together; never leave an obsolete ledger behind.
  await sequelize.transaction(async (transaction) => {
    await sequelize.query("SELECT pg_advisory_xact_lock(hashtextextended('ijshub:migrations', 0))", { transaction })
    await sequelize.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public', { transaction })
  })
  await runPendingMigrations()
}

module.exports = { assertResetAllowed, resetDatabase }
