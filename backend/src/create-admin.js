require('dotenv').config()
const bcrypt = require('bcryptjs')
const Joi = require('joi')
const { sequelize } = require('./db')
const { User } = require('./models')
const { runPendingMigrations } = require('./db/migrator')
const { assertUniqueIdentity } = require('./utils/userIdentity')

async function createAdmin () {
  const { value, error } = Joi.object({
    email: Joi.string().trim().lowercase().email().max(255).required(),
    password: Joi.string().min(12).required().custom((value, helpers) => Buffer.byteLength(value, 'utf8') <= 72 ? value : helpers.error('any.invalid'))
  }).validate({ email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD })
  if (error) throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD (12+ characters, at most 72 UTF-8 bytes)')
  await runPendingMigrations()
  const passwordHash = await bcrypt.hash(value.password, 12)
  await sequelize.transaction(async (transaction) => {
    await assertUniqueIdentity({ email: value.email, transaction })
    await User.create({ email: value.email, passwordHash, role: 'admin', firstName: 'Admin', lastName: 'System' }, { transaction })
  })
  console.log('Administrator created')
}

if (require.main === module) {
  createAdmin().catch((error) => { console.error(error.message); process.exitCode = 1 })
    .finally(() => sequelize.close())
}
module.exports = { createAdmin }
