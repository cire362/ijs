function stripControlChars(s) {
  return String(s).replace(
    /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g,
    ""
  );
}

function normalizeSpace(s) {
  return stripControlChars(s).trim().replace(/\s+/g, " ");
}

function toSafeText(v, { maxLen = 5000, normalize = false } = {}) {
  const raw = v == null ? "" : String(v);
  const base = normalize ? normalizeSpace(raw) : stripControlChars(raw);
  const trimmed = normalize ? base : base.trim();
  if (trimmed.length <= maxLen) return trimmed;
  return trimmed.slice(0, maxLen);
}

function parseIntStrict(v) {
  if (v == null) return null;
  const s = String(v).trim();
  if (!/^[0-9]+$/.test(s)) return null;
  const n = Number(s);
  if (!Number.isSafeInteger(n)) return null;
  return n;
}

function requireIdParam(req, res, paramName = "id") {
  const id = parseIntStrict(req.params?.[paramName]);
  if (id == null) {
    res.status(400).json({ error: `Некорректный ${paramName}` });
    return null;
  }
  return id;
}

function optionalIdQuery(req, res, queryName) {
  const raw = req.query?.[queryName];
  if (raw == null || raw === "") return null;
  const id = parseIntStrict(raw);
  if (id == null) {
    res.status(400).json({ error: `Некорректный ${queryName}` });
    return null;
  }
  return id;
}

function parseOptionalPositiveInt(v, { min = 1, max = 1_000_000 } = {}) {
  const n = parseIntStrict(v);
  if (n == null) return null;
  if (n < min || n > max) return null;
  return n;
}

module.exports = {
  stripControlChars,
  normalizeSpace,
  toSafeText,
  parseIntStrict,
  requireIdParam,
  optionalIdQuery,
  parseOptionalPositiveInt,
};
