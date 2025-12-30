function requireCsrf(req, res, next) {
  const cookieToken = req.cookies?.csrf_token;
  const headerToken = req.get("x-csrf-token");

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return res.status(403).json({ error: "CSRF проверка не пройдена" });
  }

  return next();
}

module.exports = { requireCsrf };
