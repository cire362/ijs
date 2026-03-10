require("dotenv").config();

const http = require("http");
const jwt = require("jsonwebtoken");
const { sequelize } = require("./db");
const app = require("./app");
const {
  Notification,
  ChatMessage,
  User,
  Application,
  SupportChat,
} = require("./models");
const { Server } = require("socket.io");
const { expireSentApplications } = require("./jobs/applicationExpiry");
const { sendEventReminders } = require("./jobs/eventReminders");
const { startScheduledJobs } = require("./jobs/scheduler");
const { setIO } = require("./socket");
const { runPendingMigrations } = require("./db/migrator");
const { getJwtSecret } = require("./utils/secrets");
const { getSocketCorsOptions } = require("./utils/cors");
const { verifyGuestSupportSession } = require("./utils/guestSupportSession");
const logger = require("./utils/logger");

const jwtSecret = getJwtSecret();

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
const io = new Server(server, { cors: getSocketCorsOptions() });
setIO(io);

let stopScheduledJobs = () => {};
let shuttingDown = false;

async function getUserFromToken(token) {
  if (!token) return null;
  try {
    const payload = jwt.verify(token, jwtSecret);
    const user = await User.findByPk(payload.sub);
    return user || null;
  } catch {
    return null;
  }
}

async function canAccessApplicationChat(appEntity, user) {
  if (!user || !appEntity) return false;
  if (user.role === "admin") return true;
  if (
    ["agent", "individual"].includes(user.role) &&
    appEntity.agentId === user.id
  ) {
    return true;
  }
  return false;
}

function parseSocketPayload(payload) {
  if (payload && typeof payload === "object") return payload;
  return { roomId: payload };
}

function resolveSupportRoomId({ requestedRoomId, guestToken, user }) {
  if (user) {
    return `user:${user.id}`;
  }

  const guestSession = verifyGuestSupportSession(guestToken);
  if (!guestSession) return null;

  const normalized = String(requestedRoomId || "").trim();
  if (normalized && normalized !== guestSession.roomId) {
    return null;
  }

  return guestSession.roomId;
}

io.on("connection", (socket) => {
  socket.on("subscribe", async (payload) => {
    const data = payload && typeof payload === "object" ? payload : {};
    const requestedUserId = parseInt(data.userId, 10);
    if (!Number.isFinite(requestedUserId)) return;

    const user = await getUserFromToken(data.token);
    if (!user) return;
    if (user.role !== "admin" && user.id !== requestedUserId) return;

    socket.join(`user:${requestedUserId}`);
  });

  // Admin joins the admin room
  socket.on("admin_subscribe", async (payload) => {
    const user = await getUserFromToken(payload?.token);
    if (!user || user.role !== "admin") return;
    socket.join("admins");
  });

  // Admin room for application chats (all applications)
  socket.on("application_admin_subscribe", async (payload) => {
    try {
      const token = payload?.token;
      const user = await getUserFromToken(token);
      if (!user || user.role !== "admin") return;
      socket.join("application_admins");
      socket.emit("application_admin_subscribed", { ok: true });
    } catch (e) {
      logger.error("application_admin_subscribe_failed", e);
    }
  });

  socket.on("chat_message", async (msg) => {
    const tokenUser = await getUserFromToken(msg?.token);
    const incomingEmail = msg?.senderEmail || msg?.email || null;
    const roomId = resolveSupportRoomId({
      requestedRoomId: msg?.roomId,
      guestToken: msg?.guestToken,
      user: tokenUser,
    });

    if (!roomId) {
      socket.emit("support_auth_error", {
        code: "invalid_guest_session",
        message: "Недействительная guest-сессия поддержки",
      });
      return;
    }

    let senderName = msg?.senderName || msg?.name || null;
    let senderEmail = incomingEmail;

    // If the room is bound to an authenticated user, we can hydrate missing identity.
    if (/^user:\d+$/.test(roomId)) {
      const userId = parseInt(roomId.split(":")[1], 10);
      if (!Number.isFinite(userId)) return;

      const user = tokenUser;
      if (!user) return;
      if (user.role !== "admin" && user.id !== userId) return;

      senderName = senderName || user.fullName || user.name || null;
      senderEmail = senderEmail || user.email || null;
    }

    try {
      await ChatMessage.create({
        senderName,
        senderEmail,
        text: msg.text,
        isAdmin: false,
        roomId,
        isRead: false,
      });

      // If this chat was resolved, move it back to "new".
      let movedToNew = false;
      try {
        const [affected] = await SupportChat.update(
          { isResolved: false, resolvedAt: null, resolvedBy: null },
          { where: { roomId, isResolved: true } },
        );
        movedToNew = affected > 0;
      } catch (e) {
        logger.error("support_chat_update_failed", e);
      }

      // Notify admins
      io.to("admins").emit("new_support_message", {
        ...msg,
        senderName,
        senderEmail,
        roomId,
        timestamp: new Date(),
        isResolved: false,
        movedToNew,
      });

      // Confirm to user
      socket.emit("message_sent", { status: "ok" });
    } catch (e) {
      logger.error("chat_message_failed", e);
    }
  });

  socket.on("admin_reply", async (msg) => {
    try {
      const user = await getUserFromToken(msg?.token);
      if (!user || user.role !== "admin") return;

      await ChatMessage.create({
        text: msg.text,
        isAdmin: true,
        roomId: msg.roomId,
        isRead: true,
      });

      io.to(msg.roomId).emit("chat_message", {
        text: msg.text,
        sender: "support",
        timestamp: new Date(),
      });
    } catch (e) {
      logger.error("admin_reply_failed", e);
    }
  });

  socket.on("join_room", async (payload) => {
    const data = parseSocketPayload(payload);
    const roomId = String(data?.roomId || "").trim();
    if (!roomId) return;

    if (/^user:\d+$/.test(roomId)) {
      const user = await getUserFromToken(data?.token);
      const userId = parseInt(roomId.split(":")[1], 10);
      if (!user || !Number.isFinite(userId)) return;
      if (user.role !== "admin" && user.id !== userId) return;
      socket.join(roomId);
      return;
    }

    if (roomId === "admins" || roomId === "application_admins") {
      const user = await getUserFromToken(data?.token);
      if (!user || user.role !== "admin") return;
      socket.join(roomId);
      return;
    }

    const guestSession = verifyGuestSupportSession(data?.guestToken);
    if (guestSession && guestSession.roomId === roomId) {
      socket.join(roomId);
      return;
    }

    socket.emit("support_auth_error", {
      code: "invalid_guest_session",
      message: "Недействительная guest-сессия поддержки",
    });
  });

  // Application chat rooms (1 application = 1 chat)
  socket.on("application_chat_join", async (payload) => {
    try {
      const applicationId = parseInt(payload?.applicationId, 10);
      const token = payload?.token;
      if (!Number.isFinite(applicationId)) return;

      const user = await getUserFromToken(token);
      if (!user) return;
      if (!["admin", "agent", "individual"].includes(user.role)) return;

      const appEntity = await Application.findByPk(applicationId);
      if (!appEntity) return;
      if (!(await canAccessApplicationChat(appEntity, user))) return;

      socket.join(`application:${applicationId}`);
      socket.emit("application_chat_joined", { applicationId });
    } catch (e) {
      logger.error("application_chat_join_failed", e);
    }
  });

  socket.on("application_chat_leave", (payload) => {
    const applicationId = parseInt(payload?.applicationId, 10);
    if (!Number.isFinite(applicationId)) return;
    socket.leave(`application:${applicationId}`);
  });
});

// Hook to send notifications to sockets when they are created
Notification.addHook("afterCreate", (notification) => {
  const room = `user:${notification.userId}`;
  io.to(room).emit("notification", notification.toJSON());
});

// bulkCreate does NOT trigger afterCreate per-row by default
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
    const appliedMigrations = await runPendingMigrations();

    logger.info("db_connected", { database: dbInfo() });
    if (appliedMigrations.length > 0) {
      logger.info("migrations_applied", { appliedMigrations });
    }

    stopScheduledJobs = startScheduledJobs(
      [
        {
          name: "expire-sent-applications",
          intervalMs: 60 * 1000,
          job: expireSentApplications,
        },
        {
          name: "send-event-reminders",
          intervalMs: 60 * 1000,
          job: sendEventReminders,
        },
      ],
      logger,
    );

    server.listen(port, () => {
      logger.info("api_listening", { port: Number(port) });
    });
  } catch (err) {
    logger.error("server_start_failed", err);
    process.exit(1);
  }
}

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;

  logger.info("shutdown_started", { signal });
  stopScheduledJobs();

  const forceExitTimer = setTimeout(() => {
    logger.error("shutdown_timed_out");
    process.exit(1);
  }, 10000);
  forceExitTimer.unref?.();

  try {
    await new Promise((resolve) => {
      io.close(() => resolve());
    });

    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });

    await sequelize.close();
    clearTimeout(forceExitTimer);
    process.exit(0);
  } catch (error) {
    logger.error("shutdown_failed", error);
    process.exit(1);
  }
}

process.on("SIGTERM", () => {
  shutdown("SIGTERM").catch((error) => {
    logger.error("shutdown_signal_failed", { signal: "SIGTERM", error });
  });
});

process.on("SIGINT", () => {
  shutdown("SIGINT").catch((error) => {
    logger.error("shutdown_signal_failed", { signal: "SIGINT", error });
  });
});

bootstrap();
