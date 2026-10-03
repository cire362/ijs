const { Op } = require('sequelize')

async function messageOptions (Model, scope, query = {}) {
  const cursorId = query.beforeId || query.afterId
  const where = { ...scope }
  if (cursorId) {
    const cursor = await Model.findOne({ where: { ...scope, id: cursorId }, attributes: ['id', 'createdAt'] })
    if (!cursor) throw { status: 400, message: 'Некорректная граница истории чата' }
    const compare = query.beforeId ? Op.lt : Op.gt
    where[Op.or] = [{ createdAt: { [compare]: cursor.createdAt } }, { createdAt: cursor.createdAt, id: { [compare]: cursor.id } }]
  }
  const limit = query.limit || (cursorId ? 50 : undefined)
  const reverse = Boolean(limit && !query.afterId)
  const direction = reverse ? 'DESC' : 'ASC'
  return { options: { where, limit, order: [['createdAt', direction], ['id', direction]] }, reverse }
}

module.exports = { messageOptions }
