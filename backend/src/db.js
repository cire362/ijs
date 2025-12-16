const { Sequelize } = require("sequelize");
const dotenv = require("dotenv");

dotenv.config();

const isTest = process.env.NODE_ENV === "test";
const connectionString = isTest
  ? process.env.TEST_DATABASE_URL ||
    process.env.DATABASE_URL ||
    "postgres://postgres:123@localhost:5432/ijshub"
  : process.env.DATABASE_URL || "postgres://postgres:123@localhost:5432/ijshub";

const sequelize = new Sequelize(connectionString, {
  logging: false,
  define: {
    underscored: true,
  },
});

module.exports = { sequelize };
