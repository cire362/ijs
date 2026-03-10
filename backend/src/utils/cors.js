function normalizeOrigin(value) {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\/$/, "");
}

function parseBool(value, fallback) {
  if (value == null) return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "y", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "n", "off"].includes(normalized)) return false;
  return fallback;
}

function splitOrigins(raw) {
  if (!raw || typeof raw !== "string") return [];
  return raw
    .split(",")
    .map((item) => normalizeOrigin(item))
    .filter(Boolean);
}

function getAllowedOrigins() {
  const configured = splitOrigins(process.env.CORS_ALLOWED_ORIGINS);
  const appOrigin = normalizeOrigin(process.env.APP_ORIGIN);
  const values = [...configured];

  if (appOrigin && !values.includes(appOrigin)) {
    values.push(appOrigin);
  }

  if (values.length > 0) {
    return values;
  }

  if (process.env.NODE_ENV !== "production") {
    return [
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      "http://localhost:4173",
      "http://127.0.0.1:4173",
    ];
  }

  return [];
}

function createOriginValidator(allowedOrigins) {
  return (origin, callback) => {
    if (!origin) {
      callback(null, true);
      return;
    }

    const normalized = normalizeOrigin(origin);
    if (allowedOrigins.includes(normalized)) {
      callback(null, true);
      return;
    }

    callback(new Error("CORS origin denied"));
  };
}

function getHttpCorsOptions() {
  const allowedOrigins = getAllowedOrigins();
  const credentials = parseBool(process.env.CORS_ALLOW_CREDENTIALS, false);

  return {
    origin: createOriginValidator(allowedOrigins),
    credentials,
  };
}

function getSocketCorsOptions() {
  const allowedOrigins = getAllowedOrigins();
  const credentials = parseBool(process.env.CORS_ALLOW_CREDENTIALS, false);

  return {
    origin: createOriginValidator(allowedOrigins),
    credentials,
  };
}

module.exports = {
  getAllowedOrigins,
  getHttpCorsOptions,
  getSocketCorsOptions,
};
