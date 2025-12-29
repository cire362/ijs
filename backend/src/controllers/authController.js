const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { User, Notification } = require("../models");

const allowedRoles = ["agent", "developer"];
const jwtSecret = process.env.JWT_SECRET || "dev_jwt_secret";

async function register(req, res) {
  try {
    const {
      firstName,
      lastName,
      middleName,
      name,
      email,
      phone,
      password,
      role,
      companyName,
    } = req.body || {};

    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ error: "Недопустимая роль" });
    }

    const emailNorm = String(email || "").trim();
    const phoneNorm = String(phone || "").trim();
    const passwordNorm = String(password || "");

    if (!emailNorm) {
      return res.status(400).json({ error: "Укажите email" });
    }
    if (!phoneNorm) {
      return res.status(400).json({ error: "Телефон обязателен" });
    }
    if (!passwordNorm) {
      return res.status(400).json({ error: "Укажите пароль" });
    }
    if (passwordNorm.length < 6) {
      return res.status(400).json({ error: "Пароль слишком короткий" });
    }

    const exists = await User.findOne({ where: { email: emailNorm } });
    if (exists) {
      return res.status(409).json({ error: "Email уже зарегистрирован" });
    }

    const passwordHash = await bcrypt.hash(passwordNorm, 10);

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
      email: emailNorm,
      phone: phoneNorm,
      passwordHash,
      role,
      companyName,
      developerApproved: role === "developer" ? false : true,
    });

    if (role === "developer") {
      const admins = await User.findAll({ where: { role: "admin" } });
      if (admins.length) {
        const display =
          user.companyName ||
          [user.lastName, user.firstName, user.middleName]
            .filter(Boolean)
            .join(" ") ||
          user.email;
        await Notification.bulkCreate(
          admins.map((a) => ({
            userId: a.id,
            type: "developer_registration",
            text: `Новая регистрация застройщика: ${display}`,
            meta: {
              developerId: user.id,
              email: user.email,
              companyName: user.companyName,
            },
          }))
        );
      }
    }

    return res
      .status(201)
      .json({ id: user.id, email: user.email, role: user.role });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Не удалось зарегистрироваться" });
  }
}

async function login(req, res) {
  const { email, password } = req.body;
  const emailNorm = String(email || "").trim();
  const passwordNorm = String(password || "");
  const user = await User.findOne({ where: { email: emailNorm } });
  if (!user)
    return res.status(401).json({ error: "Неверный email или пароль" });
  const valid = await bcrypt.compare(passwordNorm, user.passwordHash);
  if (!valid)
    return res.status(401).json({ error: "Неверный email или пароль" });

  const token = jwt.sign({ sub: user.id, role: user.role }, jwtSecret, {
    expiresIn: "1d",
  });
  return res.json({
    token,
    user: {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      middleName: user.middleName,
      fullName: user.fullName,
      role: user.role,
      developerApproved: user.developerApproved,
      avatarUrl: user.avatarUrl,
    },
  });
}

module.exports = { register, login };
