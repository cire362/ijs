const { Sequelize } = require("sequelize");
const dotenv = require("dotenv");

dotenv.config();

const connectionString =
  process.env.TEST_DATABASE_URL ||
  process.env.DATABASE_URL ||
  "postgres://postgres:123@localhost:5432/ijshub";

const sequelize = new Sequelize(connectionString, {
  logging: false,
  define: {
    underscored: true,
  },
});

module.exports = { sequelize };
