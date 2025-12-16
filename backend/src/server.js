require("dotenv").config();
const http = require("http");
const { sequelize } = require("./db");
const app = require("./app");
const { Notification } = require("./models");
const { Server } = require("socket.io");

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
    server.listen(port, () => {
      console.log(`API listening on port ${port}`);
    });
  } catch (err) {
    console.error("Failed to start server", err);
    process.exit(1);
  }
}

bootstrap();
