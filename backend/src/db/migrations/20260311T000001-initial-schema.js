const fs = require('fs')
const path = require('path')
const columns = require('./20260311T000001-columns.json')
const constraints = require('./20260311T000001-constraints.json')
const schemaSql = fs.readFileSync(path.join(__dirname, '20260311T000001-schema.sql'), 'utf8')

// Frozen baseline. Never import live models into a versioned migration.
module.exports = {
  async up ({ sequelize, transaction }) {
    const [actual] = await sequelize.query("SELECT table_name, column_name, udt_name, is_nullable, character_maximum_length, numeric_precision, numeric_scale FROM information_schema.columns WHERE table_schema='public'", { transaction })
    const tables = new Set(columns.map(column => column.table_name))
    const existing = actual.filter(column => tables.has(column.table_name))
    if (existing.length) {
      // Adopt a complete legacy schema, preserving data; incomplete schemas fail explicitly.
      const byColumn = new Map(existing.map(column => [`${column.table_name}.${column.column_name}`, column]))
      for (const expected of columns) {
        const key = `${expected.table_name}.${expected.column_name}`
        const found = byColumn.get(key)
        if (!found || Object.keys(expected).some(field => found[field] !== expected[field])) {
          throw new Error(`Existing schema differs at ${key}; repair it with an explicit migration before recording the baseline`)
        }
      }
      const [actualConstraints] = await sequelize.query(`SELECT c.relname AS table_name, co.contype,
        ARRAY(SELECT a.attname FROM unnest(co.conkey) WITH ORDINALITY k(attnum, n)
          JOIN pg_attribute a ON a.attrelid=co.conrelid AND a.attnum=k.attnum ORDER BY k.n)::text[] AS columns,
        ref.relname AS referenced_table,
        ARRAY(SELECT a.attname FROM unnest(co.confkey) WITH ORDINALITY k(attnum, n)
          JOIN pg_attribute a ON a.attrelid=co.confrelid AND a.attnum=k.attnum ORDER BY k.n)::text[] AS referenced_columns,
        co.confupdtype, co.confdeltype
        FROM pg_constraint co JOIN pg_class c ON c.oid=co.conrelid
        JOIN pg_namespace ns ON ns.oid=c.relnamespace LEFT JOIN pg_class ref ON ref.oid=co.confrelid
        WHERE ns.nspname='public' AND co.contype IN ('p','u','f')`, { transaction })
      for (const expected of constraints) {
        if (!actualConstraints.some(found => Object.keys(expected).every(key => JSON.stringify(found[key]) === JSON.stringify(expected[key])))) {
          throw new Error(`Existing schema lacks a baseline constraint on ${expected.table_name}(${expected.columns.join(',')}); repair it with an explicit migration`)
        }
      }
      const [actualIndexes] = await sequelize.query(`SELECT t.relname AS table_name,
        ARRAY(SELECT pg_get_indexdef(i.indexrelid, n, true) FROM generate_series(1, i.indnkeyatts) n)::text[] AS columns
        FROM pg_index i JOIN pg_class t ON t.oid=i.indrelid JOIN pg_namespace ns ON ns.oid=t.relnamespace
        WHERE ns.nspname='public' AND i.indisunique AND i.indisvalid AND i.indpred IS NULL`, { transaction })
      for (const match of schemaSql.matchAll(/^CREATE UNIQUE INDEX (\w+) ON public\.(\w+) USING btree \(([^)]+)\);$/gm)) {
        const expectedColumns = match[3].split(',').map(column => column.trim())
        if (!actualIndexes.some(index => index.table_name === match[2] && JSON.stringify(index.columns.map(column => column.replaceAll('"', ''))) === JSON.stringify(expectedColumns))) {
          throw new Error(`Existing schema lacks unique index ${match[1]}; repair it with an explicit migration`)
        }
      }
      return
    }
    await sequelize.query(schemaSql, { transaction })
  }
}
