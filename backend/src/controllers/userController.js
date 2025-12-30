const { Op } = require("sequelize");
const bcrypt = require("bcryptjs");
const { Property, User, Notification } = require("../models");

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
    developerApproved: user.developerApproved,
    developerRejected: user.developerRejected,
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
      return res.status(409).json({ error: "Email уже зарегистрирован" });
    }
  }

  try {
    await req.user.update(updates);
    return res.json(toPublicUser(req.user));
  } catch (err) {
    return res.status(400).json({ error: "Не удалось обновить профиль" });
  }
}

async function uploadMyAvatar(req, res) {
  if (!req.file) return res.status(400).json({ error: "Файл не загружен" });

  // Store as relative URL that can be proxied via frontend (/api/uploads/...)
  const avatarUrl = `/uploads/avatars/${req.file.filename}`;
  await req.user.update({ avatarUrl });
  return res.json(toPublicUser(req.user));
}

async function changeMyPassword(req, res) {
  const currentPassword = String(req.body?.currentPassword || "");
  const newPassword = String(req.body?.newPassword || "");

  if (!currentPassword || !newPassword) {
    return res
      .status(400)
      .json({ error: "Текущий и новый пароль обязательны" });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: "Пароль слишком короткий" });
  }

  const valid = await bcrypt.compare(currentPassword, req.user.passwordHash);
  if (!valid) {
    return res.status(400).json({ error: "Текущий пароль неверный" });
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await req.user.update({ passwordHash });
  return res.status(204).send();
}

async function listDevelopers(req, res) {
  const q = String(req.query.q || req.query.search || "").trim();
  const status = String(req.query.status || "").trim();
  const approvedRaw = req.query.approved;

  const where = { role: "developer" };

  if (status === "pending") {
    where.developerApproved = false;
    where.developerRejected = false;
  } else if (status === "approved") {
    where.developerApproved = true;
  } else if (status === "rejected") {
    where.developerApproved = false;
    where.developerRejected = true;
  } else {
    // Back-compat: approved=0 means pending, approved=1 means approved
    const approvedFilter =
      approvedRaw == null || approvedRaw === ""
        ? null
        : approvedRaw === "1" ||
          approvedRaw === "true" ||
          approvedRaw === 1 ||
          approvedRaw === true
        ? true
        : approvedRaw === "0" ||
          approvedRaw === "false" ||
          approvedRaw === 0 ||
          approvedRaw === false
        ? false
        : null;

    if (approvedFilter === false) {
      where.developerApproved = false;
      where.developerRejected = false;
    } else if (approvedFilter === true) {
      where.developerApproved = true;
    }
  }

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
    limit: 200,
  });
  return res.json(users.map(toPublicUser));
}

async function approveDeveloper(req, res) {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ error: "Некорректный id" });
  }

  const user = await User.findByPk(id);
  if (!user) return res.status(404).json({ error: "Не найдено" });
  if (user.role !== "developer") {
    return res
      .status(400)
      .json({ error: "Пользователь не является застройщиком" });
  }

  await user.update({ developerApproved: true, developerRejected: false });

  await Notification.create({
    userId: user.id,
    type: "developer_status",
    text: "Ваша регистрация застройщика подтверждена администратором.",
    meta: { developerId: user.id, status: "approved" },
  });

  return res.json(toPublicUser(user));
}

async function rejectDeveloper(req, res) {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ error: "Некорректный id" });
  }

  const user = await User.findByPk(id);
  if (!user) return res.status(404).json({ error: "Не найдено" });
  if (user.role !== "developer") {
    return res
      .status(400)
      .json({ error: "Пользователь не является застройщиком" });
  }
  if (user.developerApproved) {
    return res.status(400).json({ error: "Застройщик уже подтверждён" });
  }

  await user.update({ developerApproved: false, developerRejected: true });

  await Notification.create({
    userId: user.id,
    type: "developer_status",
    text: "Ваша регистрация застройщика отклонена администратором.",
    meta: { developerId: user.id, status: "rejected" },
  });

  return res.json(toPublicUser(user));
}

async function deleteDeveloperRequest(req, res) {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ error: "Некорректный id" });
  }

  const user = await User.findByPk(id);
  if (!user) return res.status(404).json({ error: "Не найдено" });
  if (user.role !== "developer") {
    return res
      .status(400)
      .json({ error: "Пользователь не является застройщиком" });
  }
  if (user.developerApproved) {
    return res
      .status(400)
      .json({ error: "Нельзя удалить подтверждённого застройщика" });
  }

  const propsCount = await Property.count({ where: { developerId: user.id } });
  if (propsCount > 0) {
    return res
      .status(400)
      .json({ error: "Нельзя удалить застройщика с объектами" });
  }

  await user.destroy();
  return res.status(204).send();
}

async function createDeveloperByAdmin(req, res) {
  const {
    firstName,
    lastName,
    middleName,
    name,
    email,
    phone,
    password,
    companyName,
  } = req.body || {};

  const phoneNorm = String(phone || "").trim();

  if (!email || !password) {
    return res.status(400).json({ error: "Email и пароль обязательны" });
  }

  if (!phoneNorm) {
    return res.status(400).json({ error: "Телефон обязателен" });
  }

  const exists = await User.findOne({ where: { email } });
  if (exists) {
    return res.status(409).json({ error: "Email уже зарегистрирован" });
  }

  const passwordHash = await bcrypt.hash(String(password), 10);

  // Back-compat: if only legacy name provided, try to split "Фамилия Имя Отчество"
  let derivedLastName = lastName;
  let derivedFirstName = firstName;
  let derivedMiddleName = middleName;
  if ((!derivedLastName || !derivedFirstName) && typeof name === "string") {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    derivedLastName = derivedLastName || parts[0];
    derivedFirstName = derivedFirstName || parts[1];
    derivedMiddleName = derivedMiddleName || parts.slice(2).join(" ");
  }

  const user = await User.create({
    name,
    firstName: derivedFirstName,
    lastName: derivedLastName,
    middleName: derivedMiddleName,
    email,
    phone: phoneNorm,
    passwordHash,
    role: "developer",
    companyName,
    developerApproved: true,
    developerRejected: false,
  });

  return res.status(201).json(toPublicUser(user));
}

module.exports = {
  getMe,
  updateMe,
  uploadMyAvatar,
  changeMyPassword,
  listDevelopers,
  approveDeveloper,
  rejectDeveloper,
  deleteDeveloperRequest,
  createDeveloperByAdmin,
};
