const express = require("express");
const router = express.Router();
const asyncHandler = require("../utils/asyncHandler");
const { SupportRequest, ChatMessage } = require("../models");
const { optionalAuthenticate, authenticate } = require("../middleware/auth");
const { Op } = require("sequelize");

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
    res.json(chats);
  })
);

// GET /api/support/history?roomId=...
router.get(
  "/history",
  optionalAuthenticate,
  asyncHandler(async (req, res) => {
    const { roomId } = req.query;
    if (!roomId) return res.status(400).json({ error: "No roomId" });

    // Access control:
    // 1. Admin can access any room
    // 2. Auth user can access only "user:{myId}"
    // 3. Guest (no user) can access "guest:{uuid}" or "socket:..."

    // Check if user is trying to access another user's room
    if (roomId.startsWith("user:")) {
      const userId = parseInt(roomId.split(":")[1]);
      if (!req.user || (req.user.role !== "admin" && req.user.id !== userId)) {
        return res.sendStatus(403);
      }
    }

    // Note: guest rooms (socket:*, guest:*) are open if you know the ID.
    // This is acceptable for this level of security (UUID is the secret).

    const messages = await ChatMessage.findAll({
      where: { roomId },
      order: [["createdAt", "ASC"]],
    });
    res.json(messages);
  })
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
  })
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
      }
    );

    res.json({ ok: true });
  })
);

module.exports = router;
