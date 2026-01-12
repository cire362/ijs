require("dotenv").config();
const http = require("http");
const { sequelize } = require("./db");
const app = require("./app");
const { Notification, ChatMessage, User } = require("./models");
const { Server } = require("socket.io");
const { expireSentApplications } = require("./jobs/applicationExpiry");
const { sendEventReminders } = require("./jobs/eventReminders");

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

  // Admin joins the admin room
  socket.on("admin_subscribe", () => {
    // Ideally verify admin token here or trust the event if behind auth middleware (socket auth is simpler here)
    socket.join("admins");
  });

  socket.on("chat_message", async (msg) => {
    // msg: { text, sender: 'user', name?, email? }
    // Identify user by socket.id or passed user info.
    // We use socket.id as a session identifier for guests if no user info.

    // Determine room ID (could be userId or socketId)
    // For now we trust the client logic to some extent or create a unique session ID
    // Simpler: use the email as room identifier if available, or socket.id

    let roomId = msg.email ? `email:${msg.email}` : `socket:${socket.id}`;
    if (msg.roomId) roomId = msg.roomId; // Allow continuing convo

    try {
      await ChatMessage.create({
        senderName: msg.name,
        senderEmail: msg.email,
        text: msg.text,
        isAdmin: false,
        roomId: roomId,
        isRead: false,
      });

      // Notify admins
      io.to("admins").emit("new_support_message", {
        ...msg,
        roomId: roomId,
        timestamp: new Date(),
      });

      // Confirm to user
      socket.emit("message_sent", { status: "ok" });

      // OPTIONAL: Auto-reply if no admins online?
      // For now, removing the auto-reply simulation since user asked for REAL logic.
    } catch (e) {
      console.error("Chat error", e);
    }
  });

  socket.on("admin_reply", async (msg) => {
    // msg: { text, roomId }
    try {
      await ChatMessage.create({
        text: msg.text,
        isAdmin: true,
        roomId: msg.roomId,
        isRead: true,
      });

      // If roomId is socket-based
      // Just emit to the room. The user (guest or logged-in) has joined this room.
      io.to(msg.roomId).emit("chat_message", {
        text: msg.text,
        sender: "support",
        timestamp: new Date(),
      });
    } catch (e) {
      console.error("Admin reply error", e);
    }
  });

  socket.on("join_room", (roomId) => {
    socket.join(roomId);
  });
});

// Hook to send notifications to sockets when they are created
Notification.addHook("afterCreate", (notification) => {
  const room = `user:${notification.userId}`;
  io.to(room).emit("notification", notification.toJSON());
});

// bulkCreate does NOT trigger afterCreate per-row by default, so admins (often
// notified via bulkCreate) won't receive real-time socket events without this.
Notification.addHook("afterBulkCreate", (notifications) => {
  if (!Array.isArray(notifications)) return;
  for (const notification of notifications) {
    if (!notification) continue;
    const room = `user:${notification.userId}`;
    io.to(room).emit("notification", notification.toJSON());
  }
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

    // Background: event reminders (best-effort)
    setInterval(() => {
      sendEventReminders().catch((err) =>
        console.error("Failed to send event reminders", err)
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
