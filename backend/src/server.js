require("dotenv").config();
const http = require("http");
const { sequelize } = require("./db");
const app = require("./app");
const { Notification } = require("./models");
const { Server } = require("socket.io");
const { expireSentApplications } = require("./jobs/applicationExpiry");

function dbInfo() {
  const cfg = sequelize?.config;
  if (!cfg) return "(unknown)";
  const host = cfg.host || "localhost";
  const port = cfg.port || 5432;
  const db = cfg.database || "(db)";
  const user = cfg.username || "(user)";
  return `postgres://${user}:***@${host}:${port}/${db}`;
}

const port = process.env.PORT || 4000;
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

io.on("connection", (socket) => {
  socket.on("subscribe", (userId) => {
    socket.join(`user:${userId}`);
  });
});

// Hook to send notifications to sockets when they are created
Notification.addHook("afterCreate", (notification) => {
  const room = `user:${notification.userId}`;
  io.to(room).emit("notification", notification.toJSON());
});

async function bootstrap() {
  try {
    await sequelize.authenticate();
    await sequelize.sync({ alter: process.env.NODE_ENV !== "production" });

    console.log(`DB connected: ${dbInfo()}`);

    // Background: expire applications stuck at initial stage
    setInterval(() => {
      expireSentApplications().catch((err) =>
        console.error("Failed to expire applications", err)
      );
    }, 60 * 1000);

    server.listen(port, () => {
      console.log(`API listening on port ${port}`);
    });
  } catch (err) {
    console.error("Failed to start server", err);
    process.exit(1);
  }
}

bootstrap();
