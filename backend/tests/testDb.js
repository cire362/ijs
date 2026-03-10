function normalizeTableRef (t) {
  if (!t) return null

  if (typeof t === 'string') {
    return { schema: null, table: t }
  }

  const schema = t.schema || t.tableSchema || null
  const table = t.tableName || t.name || t.table || null
  if (!table) return null
  return { schema, table }
}

function quoteIdent (s) {
  return `"${String(s).replace(/"/g, '""')}"`
}

function qualify ({ schema, table }) {
  if (schema && schema !== 'public') {
    return `${quoteIdent(schema)}.${quoteIdent(table)}`
  }
  return quoteIdent(table)
}

function dbName (sequelize) {
  const cfg = sequelize?.config
  return cfg?.database || null
}

function ensureSafeTestDatabase (sequelize) {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error(
      `Refusing to reset DB because NODE_ENV=${process.env.NODE_ENV}`
    )
  }

  const name = dbName(sequelize)
  if (!name) return

  // Strong safety rail: don't allow destructive ops on non-test DB.
  if (!String(name).toLowerCase().endsWith('_test')) {
    throw new Error(
      `Refusing to reset database '${name}'. Set TEST_DATABASE_URL to a dedicated *_test database.`
    )
  }
}

async function syncAndTruncateExcept (
  sequelize,
  { keepTables = ['address_suggestions'] } = {}
) {
  ensureSafeTestDatabase(sequelize)

  await sequelize.sync({ alter: true })

  const qi = sequelize.getQueryInterface()
  const tables = await qi.showAllTables()

  const keep = new Set((keepTables || []).map((s) => String(s)))
  // Also keep any meta tables if present.
  keep.add('SequelizeMeta')
  keep.add('SequelizeData')

  const targets = []
  for (const t of Array.isArray(tables) ? tables : []) {
    const ref = normalizeTableRef(t)
    if (!ref) continue

    // showAllTables может вернуть уже квалифицированные/кавыченные имена.
    // Для простоты пропускаем, если строка явно совпадает с keep.
    if (keep.has(ref.table)) continue

    targets.push(ref)
  }

  if (!targets.length) return

  const sql = `TRUNCATE TABLE ${targets
    .map(qualify)
    .join(', ')} RESTART IDENTITY CASCADE;`
  await sequelize.query(sql)
}

module.exports = { syncAndTruncateExcept }
