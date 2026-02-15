const crypto = require("crypto");
const { getRefreshTokenSecret } = require("./secrets");

const DEFAULT_ACCESS_TTL = process.env.ACCESS_TOKEN_TTL || "15m";
const DEFAULT_REFRESH_DAYS = Number(process.env.REFRESH_TOKEN_DAYS || 30);

function parseBool(v) {
  if (v == null) return null;
  const s = String(v).trim().toLowerCase();
  if (["1", "true", "yes", "y", "on"].includes(s)) return true;
  if (["0", "false", "no", "n", "off"].includes(s)) return false;
  return null;
}

function isHttpsRequest(req) {
  if (!req) return false;
  if (req.secure) return true;
  const xfProto = req.get?.("x-forwarded-proto");
  if (xfProto && String(xfProto).toLowerCase().includes("https")) return true;
  const proto = req.protocol;
  return proto === "https";
}

function getHmacSecret() {
  return getRefreshTokenSecret();
}

function hashToken(token) {
  return crypto
    .createHmac("sha256", getHmacSecret())
    .update(String(token))
    .digest("hex");
}

function randomToken(bytes = 48) {
  return crypto.randomBytes(bytes).toString("base64url");
}

function accessTtl() {
  return DEFAULT_ACCESS_TTL;
}

function refreshTtlMs() {
  const days =
    Number.isFinite(DEFAULT_REFRESH_DAYS) && DEFAULT_REFRESH_DAYS > 0
      ? DEFAULT_REFRESH_DAYS
      : 30;
  return days * 24 * 60 * 60 * 1000;
}

function cookieCommonOptions(req) {
  const isProd = process.env.NODE_ENV === "production";
  const forced = parseBool(process.env.COOKIE_SECURE);
  const secure = forced != null ? forced : isProd && isHttpsRequest(req);
  return {
    secure,
    sameSite: "lax",
    path: "/",
  };
}

function setAuthCookies(res, { refreshToken, csrfToken }, req) {
  const maxAge = refreshTtlMs();

  res.cookie("refresh_token", refreshToken, {
    ...cookieCommonOptions(req),
    httpOnly: true,
    maxAge,
  });

  res.cookie("csrf_token", csrfToken, {
    ...cookieCommonOptions(req),
    httpOnly: false,
    maxAge,
  });
}

function clearAuthCookies(res, req) {
  res.clearCookie("refresh_token", {
    ...cookieCommonOptions(req),
    httpOnly: true,
  });
  res.clearCookie("csrf_token", {
    ...cookieCommonOptions(req),
    httpOnly: false,
  });
}

module.exports = {
  hashToken,
  randomToken,
  accessTtl,
  refreshTtlMs,
  setAuthCookies,
  clearAuthCookies,
};
