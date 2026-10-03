const { Sequelize } = require('sequelize')
const dotenv = require('dotenv')

dotenv.config()

const { validateEnvironment, databaseUrl } = require('./config/environment')
const config = validateEnvironment()
const connectionString = databaseUrl()

const sequelize = new Sequelize(connectionString, {
  logging: false,
  pool: { max: config.poolMax, min: 0, acquire: config.acquireMs, idle: 10000 },
  dialectOptions: { connectionTimeoutMillis: 5000, keepAlive: true, statement_timeout: config.queryMs, query_timeout: config.queryMs },
  retry: { max: 0 },
  define: {
    underscored: true
  }
})

module.exports = { sequelize }
