const fs = require('fs')
const path = require('path')

module.exports = {
  async up ({ sequelize, transaction }) {
    await sequelize.query(fs.readFileSync(path.join(__dirname, '20261002T000001-backend-reliability.sql'), 'utf8'), { transaction })
  }
}
