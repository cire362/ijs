process.env.JWT_SECRET = process.env.JWT_SECRET || "test_secret";
process.env.NODE_ENV = "test";
process.env.TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  "postgres://postgres:123@localhost:5432/ijshub";
