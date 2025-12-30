const { Op } = require("sequelize");
const { Notification } = require("../models");
const {
  requireIdParam,
  toSafeText,
  normalizeSpace,
} = require("../utils/validation");

function normalizeText(v) {
  return normalizeSpace(v || "");
}

function toBool(v) {
  if (v === true || v === false) return v;
  if (v == null) return null;
  const s = String(v).toLowerCase().trim();
  if (["1", "true", "yes", "y"].includes(s)) return true;
  if (["0", "false", "no", "n"].includes(s)) return false;
  return null;
}

function parsePositiveInt(v, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  const i = Math.floor(n);
  if (i <= 0) return fallback;
  return i;
}

async function listNotifications(req, res) {
  const q = normalizeText(toSafeText(req.query?.q, { maxLen: 200 }));
  const type = normalizeText(toSafeText(req.query?.type, { maxLen: 80 }));
  const isRead = toBool(req.query?.isRead);

  const where = { userId: req.user.id };
  if (type) where.type = type;
  if (isRead != null) where.isRead = isRead;
  if (q) {
    where[Op.or] = [
      { text: { [Op.iLike]: `%${q}%` } },
      { type: { [Op.iLike]: `%${q}%` } },
    ];
  }

  const page = parsePositiveInt(req.query?.page, null);
  const limitRaw = parsePositiveInt(req.query?.limit, null);
  const limit = limitRaw ? Math.min(limitRaw, 200) : null;

  if (page && limit) {
    const offset = (page - 1) * limit;
    const result = await Notification.findAndCountAll({
      where,
      order: [["createdAt", "DESC"]],
      limit,
      offset,
    });
    return res.json({ items: result.rows, total: result.count, page, limit });
  }

  const items = await Notification.findAll({
    where,
    order: [["createdAt", "DESC"]],
    limit: limit || 200,
  });
  return res.json(items);
}

async function unreadCount(req, res) {
  const count = await Notification.count({
    where: { userId: req.user.id, isRead: false },
  });
  return res.json({ count });
}

async function markRead(req, res) {
  const id = requireIdParam(req, res);
  if (id == null) return;

  const note = await Notification.findByPk(id);
  if (!note || note.userId !== req.user.id)
    return res.status(404).json({ error: "Не найдено" });
  await note.update({ isRead: true });
  return res.json(note);
}

module.exports = { listNotifications, markRead, unreadCount };
