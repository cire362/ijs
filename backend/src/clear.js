require('dotenv').config()
const { sequelize } = require('./db')
const { resetDatabase } = require('./db/reset')

resetDatabase()
  .then(() => console.log('Database reset and migrations applied'))
  .catch((error) => { console.error(error.message); process.exitCode = 1 })
  .finally(() => sequelize.close())
