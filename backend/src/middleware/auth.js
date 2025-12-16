const jwt = require("jsonwebtoken");
const { User } = require("../models");

const jwtSecret = process.env.JWT_SECRET || "dev_jwt_secret";

const optionalAuthenticate = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header) return next();

  const [, token] = header.split(" ");
  if (!token) return next();

  try {
    const payload = jwt.verify(token, jwtSecret);
    const user = await User.findByPk(payload.sub);
    if (user) req.user = user;
  } catch (err) {
    // ignore invalid token for optional auth
  }
  return next();
};

const authenticate = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: "Missing token" });

  const [, token] = header.split(" ");
  try {
    const payload = jwt.verify(token, jwtSecret);
    const user = await User.findByPk(payload.sub);
    if (!user) return res.status(401).json({ error: "User not found" });
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
};

const allowRoles =
  (...roles) =>
  (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    next();
  };

module.exports = { authenticate, optionalAuthenticate, allowRoles };
