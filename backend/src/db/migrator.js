const fs = require("fs");
const path = require("path");
const { QueryTypes, Sequelize } = require("sequelize");
const { sequelize } = require("../db");

const MIGRATIONS_TABLE = "SequelizeMeta";
const migrationsDir = path.join(__dirname, "migrations");

function normalizeTableName(entry) {
  if (!entry) return "";
  if (typeof entry === "string") return entry.replaceAll('"', "");
  return String(entry.tableName || entry.table || entry.name || "");
}

async function ensureMetaTable() {
  const queryInterface = sequelize.getQueryInterface();
  const tables = await queryInterface.showAllTables();
  const hasMeta = tables
    .map(normalizeTableName)
    .some((name) => name === MIGRATIONS_TABLE);

  if (hasMeta) return;

  await queryInterface.createTable(MIGRATIONS_TABLE, {
    name: {
      type: Sequelize.STRING,
      allowNull: false,
      primaryKey: true,
    },
  });
}

function loadMigrationFiles() {
  if (!fs.existsSync(migrationsDir)) return [];

  return fs
    .readdirSync(migrationsDir)
    .filter((fileName) => fileName.endsWith(".js"))
    .sort()
    .map((fileName) => {
      const filePath = path.join(migrationsDir, fileName);
      const migration = require(filePath);
      if (typeof migration?.up !== "function") {
        throw new Error(`Migration '${fileName}' must export an up function`);
      }

      return {
        fileName,
        useTransaction: migration.useTransaction !== false,
        up: migration.up,
        down: migration.down,
      };
    });
}

async function getAppliedMigrationNames() {
  await ensureMetaTable();

  const rows = await sequelize.query(
    `SELECT name FROM "${MIGRATIONS_TABLE}" ORDER BY name ASC`,
    { type: QueryTypes.SELECT },
  );

  return new Set(rows.map((row) => row.name));
}

function buildContext(transaction) {
  return {
    sequelize,
    queryInterface: sequelize.getQueryInterface(),
    Sequelize,
    transaction,
  };
}

async function recordMigration(fileName, transaction) {
  await sequelize
    .getQueryInterface()
    .bulkInsert(MIGRATIONS_TABLE, [{ name: fileName }], { transaction });
}

async function runPendingMigrations() {
  const migrations = loadMigrationFiles();
  const applied = await getAppliedMigrationNames();
  const pending = migrations.filter(
    (migration) => !applied.has(migration.fileName),
  );

  const appliedNow = [];

  for (const migration of pending) {
    if (migration.useTransaction) {
      await sequelize.transaction(async (transaction) => {
        await migration.up(buildContext(transaction));
        await recordMigration(migration.fileName, transaction);
      });
    } else {
      await migration.up(buildContext(null));
      await recordMigration(migration.fileName, null);
    }

    appliedNow.push(migration.fileName);
  }

  return appliedNow;
}

async function getMigrationStatus() {
  const migrations = loadMigrationFiles();
  const applied = await getAppliedMigrationNames();

  return migrations.map((migration) => ({
    name: migration.fileName,
    applied: applied.has(migration.fileName),
  }));
}

module.exports = {
  getMigrationStatus,
  runPendingMigrations,
};
