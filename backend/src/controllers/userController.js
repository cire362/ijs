const { Op } = require("sequelize");
const { User } = require("../models");

function toPublicUser(user) {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    middleName: user.middleName,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    role: user.role,
    companyName: user.companyName,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

async function getMe(req, res) {
  return res.json(toPublicUser(req.user));
}

async function updateMe(req, res) {
  const allowedFields = [
    "firstName",
    "lastName",
    "middleName",
    "phone",
    "companyName",
    "email",
  ];
  const updates = {};

  for (const key of allowedFields) {
    if (Object.prototype.hasOwnProperty.call(req.body, key)) {
      updates[key] = req.body[key];
    }
  }

  if (updates.email) {
    const exists = await User.findOne({ where: { email: updates.email } });
    if (exists && exists.id !== req.user.id) {
      return res.status(409).json({ error: "Email already registered" });
    }
  }

  try {
    await req.user.update(updates);
    return res.json(toPublicUser(req.user));
  } catch (err) {
    return res.status(400).json({ error: "Cannot update profile" });
  }
}

async function uploadMyAvatar(req, res) {
  if (!req.file) return res.status(400).json({ error: "No file" });

  // Store as relative URL that can be proxied via frontend (/api/uploads/...)
  const avatarUrl = `/uploads/avatars/${req.file.filename}`;
  await req.user.update({ avatarUrl });
  return res.json(toPublicUser(req.user));
}

async function listDevelopers(req, res) {
  const q = String(req.query.q || req.query.search || "").trim();
  const where = { role: "developer" };

  if (q) {
    where[Op.or] = [
      { email: { [Op.iLike]: `%${q}%` } },
      { companyName: { [Op.iLike]: `%${q}%` } },
      { firstName: { [Op.iLike]: `%${q}%` } },
      { lastName: { [Op.iLike]: `%${q}%` } },
      { middleName: { [Op.iLike]: `%${q}%` } },
    ];
  }

  const users = await User.findAll({
    where,
    order: [["companyName", "ASC"]],
    limit: 30,
  });
  return res.json(users.map(toPublicUser));
}

module.exports = { getMe, updateMe, uploadMyAvatar, listDevelopers };
