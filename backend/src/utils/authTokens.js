const crypto = require("crypto");

const DEFAULT_ACCESS_TTL = process.env.ACCESS_TOKEN_TTL || "15m";
const DEFAULT_REFRESH_DAYS = Number(process.env.REFRESH_TOKEN_DAYS || 30);

function getHmacSecret() {
  return (
    process.env.REFRESH_TOKEN_SECRET ||
    process.env.JWT_SECRET ||
    "dev_jwt_secret"
  );
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

function cookieCommonOptions() {
  const isProd = process.env.NODE_ENV === "production";
  return {
    secure: isProd,
    sameSite: "lax",
    path: "/",
  };
}

function setAuthCookies(res, { refreshToken, csrfToken }) {
  const maxAge = refreshTtlMs();

  res.cookie("refresh_token", refreshToken, {
    ...cookieCommonOptions(),
    httpOnly: true,
    maxAge,
  });

  res.cookie("csrf_token", csrfToken, {
    ...cookieCommonOptions(),
    httpOnly: false,
    maxAge,
  });
}

function clearAuthCookies(res) {
  res.clearCookie("refresh_token", {
    ...cookieCommonOptions(),
    httpOnly: true,
  });
  res.clearCookie("csrf_token", { ...cookieCommonOptions(), httpOnly: false });
}

module.exports = {
  hashToken,
  randomToken,
  accessTtl,
  refreshTtlMs,
  setAuthCookies,
  clearAuthCookies,
};
