require("dotenv").config();

const { sequelize } = require("./db");
const { getMigrationStatus, runPendingMigrations } = require("./db/migrator");

async function main() {
  const showStatusOnly = process.argv.includes("--status");

  await sequelize.authenticate();

  if (showStatusOnly) {
    const status = await getMigrationStatus();
    for (const item of status) {
      console.log(`${item.applied ? "[x]" : "[ ]"} ${item.name}`);
    }
    return;
  }

  const applied = await runPendingMigrations();
  if (applied.length === 0) {
    console.log("No pending migrations");
    return;
  }

  for (const name of applied) {
    console.log(`Applied migration: ${name}`);
  }
}

main()
  .catch((error) => {
    console.error("Migration command failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await sequelize.close();
    } catch {
      // Ignore shutdown errors in CLI mode.
    }
  });
