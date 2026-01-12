const { Op } = require("sequelize");
const { Notification } = require("../models");

function normalizeText(v) {
  return String(v || "").trim();
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

class NotificationService {
  async listNotifications(query, user) {
    const q = normalizeText(query.q);
    const type = normalizeText(query.type);
    const isRead = toBool(query.isRead);

    const where = { userId: user.id };
    // Exact type match if provided? Or safe text truncated?
    // Using original logic:
    if (type) where.type = type;
    if (isRead != null) where.isRead = isRead;
    if (q) {
      where[Op.or] = [
        { text: { [Op.iLike]: `%${q}%` } },
        { type: { [Op.iLike]: `%${q}%` } },
      ];
    }

    const page = parsePositiveInt(query.page, null);
    const limitRaw = parsePositiveInt(query.limit, null);
    const limit = limitRaw ? Math.min(limitRaw, 200) : null;

    if (page && limit) {
      const offset = (page - 1) * limit;
      const result = await Notification.findAndCountAll({
        where,
        order: [["createdAt", "DESC"]],
        limit,
        offset,
      });
      return { items: result.rows, total: result.count, page, limit };
    }

    return Notification.findAll({
      where,
      order: [["createdAt", "DESC"]],
      limit: limit || 200,
    });
  }

  async unreadCount(user) {
    return Notification.count({
      where: { userId: user.id, isRead: false },
    });
  }

  async markRead(id, user) {
    const note = await Notification.findByPk(id);
    if (!note || note.userId !== user.id)
      throw { status: 404, message: "Не найдено" };
    await note.update({ isRead: true });
    return note;
  }
}

module.exports = new NotificationService();
