const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { User, AuthSession, Notification } = require("../models");
const {
  hashToken,
  randomToken,
  accessTtl,
  refreshTtlMs,
  setAuthCookies,
  clearAuthCookies,
} = require("../utils/authTokens");

const jwtSecret = process.env.JWT_SECRET || "dev_jwt_secret";

function toUserPayload(user) {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    middleName: user.middleName,
    fullName: user.fullName,
    email: user.email,
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

class AuthService {
  async register(data) {
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
    } = data;

    const emailNorm = email.toLowerCase();

    const exists = await User.findOne({ where: { email: emailNorm } });
    if (exists) {
      throw { status: 409, message: "Email уже зарегистрирован" };
    }

    const passwordHash = await bcrypt.hash(password, 10);

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
      name: name || null,
      firstName: derivedFirstName || null,
      lastName: derivedLastName || null,
      middleName: derivedMiddleName || null,
      email: emailNorm,
      phone: phone,
      passwordHash,
      role,
      companyName: companyName || null,
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

    return { id: user.id, email: user.email, role: user.role };
  }

  async login(email, password, { req, res }) {
    const emailNorm = email.toLowerCase();
    const user = await User.findOne({ where: { email: emailNorm } });
    if (!user) throw { status: 401, message: "Неверный email или пароль" };

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw { status: 401, message: "Неверный email или пароль" };

    // Session logic - needs req/res context or should return tokens
    // Ideally service returns tokens, controller sets cookies.
    // But `createSessionAndSetCookies` is complex.
    // I will refactor `createSessionAndSetCookies` later, for now internal usage.

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

    const token = issueAccessToken(user);
    return { token, user: toUserPayload(user) };
  }

  async refresh(cookies, { req, res }) {
    const refreshToken = cookies.refresh_token;
    if (!refreshToken) {
      clearAuthCookies(res);
      throw { status: 401, message: "Refresh token is missing" };
    }

    const hashed = hashToken(refreshToken);
    const session = await AuthSession.findOne({
      where: { refreshTokenHash: hashed },
      include: [{ model: User }],
    });

    if (!session) {
      clearAuthCookies(res);
      throw { status: 401, message: "Session not found" };
    }

    if (session.expiresAt < new Date()) {
      await session.destroy();
      clearAuthCookies(res);
      throw { status: 401, message: "Session expired" };
    }

    const token = issueAccessToken(session.user);

    // Rotate refresh token
    await session.destroy();

    // Create new session
    const newRefreshToken = randomToken(48);
    // Reuse original IP/UserAgent if not present in request context? Or use current.
    // We have { req } passed.
    const newExpiresAt = new Date(Date.now() + refreshTtlMs());

    await AuthSession.create({
      userId: session.userId,
      refreshTokenHash: hashToken(newRefreshToken),
      expiresAt: newExpiresAt,
      ip: req.ip || session.ip,
      userAgent: req.get("user-agent") || session.userAgent,
    });

    // Set new cookies
    // Need csrfToken. Rotate csrf too? Yes usually.
    const newCsrfToken = randomToken(24);
    setAuthCookies(res, {
      refreshToken: newRefreshToken,
      csrfToken: newCsrfToken,
    });

    return { token, user: toUserPayload(session.user) };
  }

  async logout(cookies, res) {
    const refreshToken = cookies.refresh_token;
    if (refreshToken) {
      const hashed = hashToken(refreshToken);
      await AuthSession.destroy({ where: { refreshTokenHash: hashed } });
    }
    clearAuthCookies(res);
  }

  async logoutAll(cookies, res) {
    const refreshToken = cookies.refresh_token;
    if (!refreshToken) {
      // If no token, we can't identify user to logout all.
      // Maybe throw 401? Or just clear cookies and return?
      // If we can't identify, we can't kill other sessions.
      throw { status: 401, message: "No session" };
    }

    const hashed = hashToken(refreshToken);
    const session = await AuthSession.findOne({
      where: { refreshTokenHash: hashed },
    });

    if (session) {
      await AuthSession.destroy({ where: { userId: session.userId } });
    }

    clearAuthCookies(res);
  }
}

module.exports = new AuthService();
