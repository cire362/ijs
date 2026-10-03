const fs = require('fs')
const path = require('path')

module.exports = {
  async up ({ sequelize, transaction }) {
    await sequelize.query(fs.readFileSync(path.join(__dirname, '20261003T000001-business-rules.sql'), 'utf8'), { transaction })
  }
}
