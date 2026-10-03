const { Op, fn, col, where } = require('sequelize')
const { User } = require('../models')
const { sequelize } = require('../db')
const { formatRuPhone, toCanonicalRuDigits } = require('./phone')

async function lockIdentity (phone, transaction) {
  // Serialize registration, profile edits and admin creation for the same phone.
  // This also covers legacy rows whose phone is stored in a different format.
  await sequelize.query('SELECT pg_advisory_xact_lock(hashtextextended(:phone, 0))', {
    replacements: { phone: `user-phone:${phone}` }, transaction
  })
}

async function assertUniqueIdentity ({ email, phone, exceptId, transaction }) {
  const exclusion = exceptId ? { id: { [Op.ne]: exceptId } } : {}
  if (email) {
    const existing = await User.findOne({ where: { email, ...exclusion }, transaction })
    if (existing) throw { status: 409, message: 'Email уже зарегистрирован' }
  }
  if (!phone) return
  const canonical = toCanonicalRuDigits(phone)
  if (!canonical) throw { status: 400, message: 'Некорректный телефон' }
  await lockIdentity(canonical, transaction)
  const existing = await User.findOne({
    where: {
      ...exclusion,
      [Op.or]: [
        { phone: formatRuPhone(phone) },
        where(fn('regexp_replace', col('phone'), '\\D', '', 'g'), { [Op.in]: [canonical, `8${canonical.slice(1)}`] })
      ]
    },
    transaction
  })
  if (existing) throw { status: 409, message: 'Телефон уже зарегистрирован' }
}

module.exports = { assertUniqueIdentity }
