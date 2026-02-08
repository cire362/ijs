const express = require("express");
const morgan = require("morgan");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const cookieParser = require("cookie-parser");
const path = require("path");
const authRoutes = require("./routes/auth");
const propertyRoutes = require("./routes/properties");
const applicationRoutes = require("./routes/applications");
const notificationRoutes = require("./routes/notifications");
const userRoutes = require("./routes/users");
const newsRoutes = require("./routes/news");
const eventsRoutes = require("./routes/events");
const addressRoutes = require("./routes/address");
const supportRoutes = require("./routes/support");
const tariffRoutes = require("./routes/tariffs");

const app = express();

// Behind nginx/reverse proxy in production we want correct client IP for rate limiting.
if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

app.use(cors({ origin: true, credentials: false }));
app.use(
  helmet({
    // API also serves images from /uploads that are consumed by the frontend.
    // Avoid blocking cross-origin image loads.
    crossOriginResourcePolicy: false,
  }),
);

const apiLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Слишком много запросов, попробуйте позже" },
  skip: (req) => req.path === "/health" || req.path.startsWith("/uploads"),
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Слишком много попыток, попробуйте позже" },
});

app.use(apiLimiter);
app.use(cookieParser());
app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));

app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

app.get("/health", (req, res) => res.json({ ok: true }));
app.use("/address", addressRoutes);
app.use("/auth", authLimiter, authRoutes);
app.use("/properties", propertyRoutes);
app.use("/applications", applicationRoutes);
app.use("/notifications", notificationRoutes);
app.use("/users", userRoutes);
app.use("/news", newsRoutes);
app.use("/events", eventsRoutes);
app.use("/support", supportRoutes);
app.use("/tariffs", tariffRoutes);

app.use((err, req, res, next) => {
  console.error(err);

  if (err.status) {
    return res.status(err.status).json({ error: err.message });
  }

  // Sequelize Validation Error
  if (err.name === "SequelizeValidationError") {
    return res
      .status(400)
      .json({ error: err.errors.map((e) => e.message).join(", ") });
  }

  // Postgres invalid integer (22P02)
  if (err.name === "SequelizeDatabaseError" && err.parent?.code === "22P02") {
    return res.status(400).json({ error: "Некорректный ID" });
  }

  res.status(500).json({ error: "Внутренняя ошибка" });
});

module.exports = app;
