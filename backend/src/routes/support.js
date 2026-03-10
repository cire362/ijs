const express = require("express");
const router = express.Router();
const asyncHandler = require("../utils/asyncHandler");
const { SupportRequest, ChatMessage, SupportChat } = require("../models");
const { optionalAuthenticate, authenticate } = require("../middleware/auth");
const {
  issueGuestSupportSession,
  verifyGuestSupportSession,
} = require("../utils/guestSupportSession");

function readGuestSupportSession(req) {
  const headerToken = req.headers["x-support-guest-token"];
  const bodyToken = req.body?.guestToken;
  const queryToken = req.query?.guestToken;
  const guestToken = headerToken || bodyToken || queryToken;
  return verifyGuestSupportSession(guestToken);
}

router.post(
  "/guest-session",
  optionalAuthenticate,
  asyncHandler(async (req, res) => {
    if (req.user) {
      return res.json({ roomId: `user:${req.user.id}`, guestToken: null });
    }

    const requestedRoomId = req.body?.roomId;
    const existingSession = readGuestSupportSession(req);

    if (
      existingSession &&
      (!requestedRoomId || requestedRoomId === existingSession.roomId)
    ) {
      return res.json(existingSession);
    }

    return res.status(201).json(issueGuestSupportSession());
  }),
);

// GET /api/support/chats - Get list of unique chats (Admin only)
router.get(
  "/chats",
  authenticate,
  asyncHandler(async (req, res) => {
    if (req.user.role !== "admin") return res.sendStatus(403);

    // Fetch all messages to group them
    const messages = await ChatMessage.findAll({
      attributes: [
        "roomId",
        "senderName",
        "senderEmail",
        "text",
        "createdAt",
        "isRead",
        "isAdmin",
      ],
      order: [["createdAt", "DESC"]],
    });

    const chatsMap = new Map();

    for (const msg of messages) {
      if (!chatsMap.has(msg.roomId)) {
        chatsMap.set(msg.roomId, {
          roomId: msg.roomId,
          senderName: msg.senderName || "Гость",
          senderEmail: msg.senderEmail,
          lastMessage: msg.text,
          lastTime: msg.createdAt,
          unreadCount: 0,
        });
      }

      // Count unread (only incoming messages that are not read)
      if (!msg.isRead && !msg.isAdmin) {
        const chat = chatsMap.get(msg.roomId);
        chat.unreadCount++;
      }
    }

    const chats = Array.from(chatsMap.values());

    // Attach resolve status per room
    const roomIds = chats.map((c) => c.roomId).filter(Boolean);
    const states = roomIds.length
      ? await SupportChat.findAll({
          where: { roomId: roomIds },
          attributes: ["roomId", "isResolved", "resolvedAt", "resolvedBy"],
        })
      : [];
    const stateMap = new Map(states.map((s) => [s.roomId, s]));

    for (const c of chats) {
      const st = stateMap.get(c.roomId);
      c.isResolved = Boolean(st?.isResolved);
      c.resolvedAt = st?.resolvedAt || null;
      c.resolvedBy = st?.resolvedBy || null;
    }

    res.json(chats);
  }),
);

// POST /api/support/chats/resolve - Mark chat resolved/unresolved (Admin only)
router.post(
  "/chats/resolve",
  authenticate,
  asyncHandler(async (req, res) => {
    if (req.user.role !== "admin") return res.sendStatus(403);

    const { roomId, resolved } = req.body || {};
    if (!roomId) return res.status(400).json({ error: "No roomId" });

    const wantResolved = Boolean(resolved);

    await SupportChat.upsert({
      roomId,
      isResolved: wantResolved,
      resolvedAt: wantResolved ? new Date() : null,
      resolvedBy: wantResolved ? req.user.id : null,
    });

    res.json({ ok: true, roomId, isResolved: wantResolved });
  }),
);

// GET /api/support/history?roomId=...
router.get(
  "/history",
  optionalAuthenticate,
  asyncHandler(async (req, res) => {
    const { roomId } = req.query;
    if (!roomId) return res.status(400).json({ error: "No roomId" });

    if (!req.user) {
      const guestSession = readGuestSupportSession(req);
      if (!guestSession || guestSession.roomId !== roomId) {
        return res.status(403).json({ error: "Недействительная guest-сессия" });
      }
    } else if (req.user.role !== "admin") {
      const expectedRoomId = `user:${req.user.id}`;
      if (roomId !== expectedRoomId) {
        return res.sendStatus(403);
      }
    }

    const messages = await ChatMessage.findAll({
      where: { roomId },
      order: [["createdAt", "ASC"]],
    });
    res.json(messages);
  }),
);

router.post(
  "/",
  optionalAuthenticate,
  asyncHandler(async (req, res) => {
    const { message, email, name } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: "Сообщение не может быть пустым" });
    }

    const ip = req.ip || req.connection.remoteAddress;

    // Use logged-in user data if available
    let senderName = name;
    let senderEmail = email;

    if (req.user) {
      senderName = senderName || req.user.fullName;
      senderEmail = senderEmail || req.user.email;
    }

    await SupportRequest.create({
      name: senderName || "Гость",
      email: senderEmail,
      message,
      ip,
    });

    res.json({ success: true, message: "Сообщение отправлено" });
  }),
);

// POST /api/support/read - Mark messages as read (Admin only)
router.post(
  "/read",
  authenticate,
  asyncHandler(async (req, res) => {
    if (req.user.role !== "admin") return res.sendStatus(403);

    const { roomId } = req.body;
    if (!roomId) return res.status(400).json({ error: "No roomId" });

    await ChatMessage.update(
      { isRead: true },
      {
        where: {
          roomId,
          isAdmin: false,
          isRead: false,
        },
      },
    );

    res.json({ ok: true });
  }),
);

module.exports = router;
