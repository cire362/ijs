const { Notification } = require("../models");

async function listNotifications(req, res) {
  const items = await Notification.findAll({
    where: { userId: req.user.id },
    order: [["createdAt", "DESC"]],
  });
  return res.json(items);
}

async function markRead(req, res) {
  const note = await Notification.findByPk(req.params.id);
  if (!note || note.userId !== req.user.id)
    return res.status(404).json({ error: "Not found" });
  await note.update({ isRead: true });
  return res.json(note);
}

module.exports = { listNotifications, markRead };
