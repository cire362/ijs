const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { User, Notification, AuthSession } = require("../models");
const { toSafeText, normalizeSpace } = require("../utils/validation");
const {
  hashToken,
  randomToken,
  accessTtl,
  refreshTtlMs,
  setAuthCookies,
  clearAuthCookies,
} = require("../utils/authTokens");

const allowedRoles = ["agent", "developer"];
const jwtSecret = process.env.JWT_SECRET || "dev_jwt_secret";

function toUserPayload(user) {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    middleName: user.middleName,
    fullName: user.fullName,
    role: user.role,
    developerApproved: user.developerApproved,
    avatarUrl: user.avatarUrl,
  };
}

function issueAccessToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, jwtSecret, {
    expiresIn: accessTtl(),
  });
}

async function createSessionAndSetCookies({ req, res, user }) {
  const refreshToken = randomToken(48);
  const csrfToken = randomToken(24);
  const now = Date.now();
  const expiresAt = new Date(now + refreshTtlMs());

  await AuthSession.create({
    userId: user.id,
    refreshTokenHash: hashToken(refreshToken),
    expiresAt,
    ip: req.ip || null,
    userAgent: req.get("user-agent") || null,
  });

  setAuthCookies(res, { refreshToken, csrfToken });
}

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

    const emailNorm = normalizeSpace(
      toSafeText(email, { maxLen: 254 })
    ).toLowerCase();
    const phoneNorm = normalizeSpace(toSafeText(phone, { maxLen: 50 }));
    const passwordNorm = toSafeText(password, { maxLen: 200 });

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
      name: normalizeSpace(toSafeText(name, { maxLen: 200 })) || null,
      firstName:
        normalizeSpace(toSafeText(derivedFirstName, { maxLen: 80 })) || null,
      lastName:
        normalizeSpace(toSafeText(derivedLastName, { maxLen: 80 })) || null,
      middleName:
        normalizeSpace(toSafeText(derivedMiddleName, { maxLen: 120 })) || null,
      email: emailNorm,
      phone: phoneNorm,
      passwordHash,
      role,
      companyName:
        normalizeSpace(toSafeText(companyName, { maxLen: 200 })) || null,
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
  const emailNorm = normalizeSpace(
    toSafeText(email, { maxLen: 254 })
  ).toLowerCase();
  const passwordNorm = toSafeText(password, { maxLen: 200 });
  const user = await User.findOne({ where: { email: emailNorm } });
  if (!user)
    return res.status(401).json({ error: "Неверный email или пароль" });
  const valid = await bcrypt.compare(passwordNorm, user.passwordHash);
  if (!valid)
    return res.status(401).json({ error: "Неверный email или пароль" });

  await createSessionAndSetCookies({ req, res, user });

  const token = issueAccessToken(user);
  return res.json({ token, user: toUserPayload(user) });
}

async function refresh(req, res) {
  const refreshToken = req.cookies?.refresh_token;
  if (!refreshToken) {
    clearAuthCookies(res);
    return res.status(401).json({ error: "Сессия не найдена" });
  }

  const tokenHash = hashToken(refreshToken);
  const session = await AuthSession.findOne({
    where: { refreshTokenHash: tokenHash, revokedAt: null },
  });

  if (!session) {
    clearAuthCookies(res);
    return res.status(401).json({ error: "Сессия не найдена" });
  }

  if (session.expiresAt && session.expiresAt.getTime() < Date.now()) {
    await session.update({ revokedAt: new Date() });
    clearAuthCookies(res);
    return res.status(401).json({ error: "Сессия истекла" });
  }

  const user = await User.findByPk(session.userId);
  if (!user) {
    await session.update({ revokedAt: new Date() });
    clearAuthCookies(res);
    return res.status(401).json({ error: "Пользователь не найден" });
  }

  // Rotate refresh token
  const newRefresh = randomToken(48);
  const newCsrf = randomToken(24);
  const newSession = await AuthSession.create({
    userId: user.id,
    refreshTokenHash: hashToken(newRefresh),
    expiresAt: new Date(Date.now() + refreshTtlMs()),
    ip: req.ip || null,
    userAgent: req.get("user-agent") || null,
  });

  await session.update({ revokedAt: new Date(), replacedById: newSession.id });
  setAuthCookies(res, { refreshToken: newRefresh, csrfToken: newCsrf });

  const token = issueAccessToken(user);
  return res.json({ token, user: toUserPayload(user) });
}

async function logout(req, res) {
  const refreshToken = req.cookies?.refresh_token;
  if (refreshToken) {
    const tokenHash = hashToken(refreshToken);
    const session = await AuthSession.findOne({
      where: { refreshTokenHash: tokenHash, revokedAt: null },
    });
    if (session) {
      await session.update({ revokedAt: new Date() });
    }
  }

  clearAuthCookies(res);
  return res.json({ ok: true });
}

async function logoutAll(req, res) {
  const refreshToken = req.cookies?.refresh_token;
  if (!refreshToken) {
    clearAuthCookies(res);
    return res.json({ ok: true });
  }

  const tokenHash = hashToken(refreshToken);
  const session = await AuthSession.findOne({
    where: { refreshTokenHash: tokenHash, revokedAt: null },
  });

  if (session) {
    await AuthSession.update(
      { revokedAt: new Date() },
      { where: { userId: session.userId, revokedAt: null } }
    );
  }

  clearAuthCookies(res);
  return res.json({ ok: true });
}

module.exports = { register, login, refresh, logout, logoutAll };
