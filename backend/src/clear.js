require("dotenv").config();

const { sequelize } = require("./db");
// Important: register all models before sync()
require("./models");

function maskDbUrl(url) {
  if (!url || typeof url !== "string") return url;
  // postgres://user:pass@host:port/db -> postgres://user:***@host:port/db
  return url.replace(/:\/\/([^:]+):([^@]+)@/i, "://$1:***@");
}

async function clear() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to clear DB in production");
  }

  const usedUrl = sequelize?.config?.database
    ? `postgres://***@${sequelize.config.host}:${sequelize.config.port}/${sequelize.config.database}`
    : maskDbUrl(
        process.env.DATABASE_URL ||
          "postgres://postgres:123@localhost:5432/ijshub"
      );

  console.log(`NODE_ENV=${process.env.NODE_ENV || "(not set)"}`);
  console.log(`Clearing DB: ${usedUrl}`);

  await sequelize.authenticate();
  await sequelize.sync({ force: true });

  console.log("DB cleared (all tables dropped and recreated).");
}

clear()
  .then(() => sequelize.close())
  .catch(async (err) => {
    console.error(err);
    try {
      await sequelize.close();
    } catch (_) {}
    process.exit(1);
  });
