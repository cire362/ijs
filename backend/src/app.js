const express = require("express");
const morgan = require("morgan");
const cors = require("cors");
const path = require("path");
const authRoutes = require("./routes/auth");
const propertyRoutes = require("./routes/properties");
const applicationRoutes = require("./routes/applications");
const notificationRoutes = require("./routes/notifications");
const userRoutes = require("./routes/users");
const newsRoutes = require("./routes/news");
const eventsRoutes = require("./routes/events");

const app = express();

app.use(cors({ origin: true, credentials: false }));
app.use(express.json());
app.use(morgan("dev"));

app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

app.get("/health", (req, res) => res.json({ ok: true }));
app.use("/auth", authRoutes);
app.use("/properties", propertyRoutes);
app.use("/applications", applicationRoutes);
app.use("/notifications", notificationRoutes);
app.use("/users", userRoutes);
app.use("/news", newsRoutes);
app.use("/events", eventsRoutes);

app.use((err, req, res, next) => {
  // Fallback error handler with minimal noise
  console.error(err);
  res.status(500).json({ error: "Внутренняя ошибка" });
});

module.exports = app;
