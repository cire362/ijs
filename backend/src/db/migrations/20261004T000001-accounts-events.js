const fs = require('fs')
const path = require('path')

module.exports = {
  async up ({ sequelize, transaction }) {
    await sequelize.query(fs.readFileSync(path.join(__dirname, '20261004T000001-accounts-events.sql'), 'utf8'), { transaction })
  }
}
