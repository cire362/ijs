const express = require("express");
const { Op } = require("sequelize");
const { toSafeText, normalizeSpace } = require("../utils/validation");
const { AddressSuggestion } = require("../models");

const router = express.Router();

// Very small in-memory cache to reduce load on upstream.
// Key: string, Value: { expiresAt: number, data: any }
const cache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_MAX = 1000;

function cacheGet(key) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    cache.delete(key);
    return null;
  }
  return hit.data;
}

function cacheSet(key, data) {
  if (cache.size >= CACHE_MAX) {
    // delete first inserted key (simple FIFO)
    const firstKey = cache.keys().next().value;
    if (firstKey) cache.delete(firstKey);
  }
  cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, data });
}

function asArray(v) {
  return Array.isArray(v) ? v : [];
}

function normalizeQ(q) {
  return normalizeSpace(toSafeText(q, { maxLen: 200 }));
}

function normalizeOptional(v, maxLen) {
  const s = normalizeSpace(toSafeText(v, { maxLen }));
  return s || null;
}

function toLowerOrNull(v) {
  if (!v) return null;
  const s = String(v).trim();
  return s ? s.toLowerCase() : null;
}

function toLowerOrNullNormalized(v) {
  if (!v) return null;
  const s = normalizeSpace(String(v));
  return s ? s.toLowerCase() : null;
}

function sortSuggestions(qLower, items) {
  const uniq = Array.isArray(items) ? items : [];
  return uniq.slice().sort((a, b) => {
    const al = String(a?.label || "").toLowerCase();
    const bl = String(b?.label || "").toLowerCase();

    const aStarts = al.startsWith(qLower);
    const bStarts = bl.startsWith(qLower);
    if (aStarts !== bStarts) return aStarts ? -1 : 1;

    if (al.length !== bl.length) return al.length - bl.length;
    return al.localeCompare(bl, "ru");
  });
}

async function searchLocal({
  kind,
  qLower,
  regionLower,
  cityLower,
  limit = 10,
}) {
  const and = [{ kind }, { labelLower: { [Op.like]: `%${qLower}%` } }];

  if (kind === "city" && regionLower) {
    and.push({ [Op.or]: [{ regionLower }, { regionLower: null }] });
  }

  if (kind === "street") {
    if (regionLower) {
      and.push({ [Op.or]: [{ regionLower }, { regionLower: null }] });
    }
    if (cityLower) {
      and.push({ [Op.or]: [{ cityLower }, { cityLower: null }] });
    }
  }

  const rows = await AddressSuggestion.findAll({
    where: { [Op.and]: and },
    limit: Math.max(limit * 3, 30),
  });

  const mapped = rows.map((r) => ({ label: r.label }));
  const sorted = sortSuggestions(qLower, mapped);

  // De-dup by label again (just in case)
  const seen = new Set();
  const unique = [];
  for (const it of sorted) {
    if (!it?.label) continue;
    if (seen.has(it.label)) continue;
    seen.add(it.label);
    unique.push(it);
    if (unique.length >= limit) break;
  }

  return unique;
}

async function storeUpstreamResults({ kind, region, city, suggestions }) {
  const rows = (Array.isArray(suggestions) ? suggestions : [])
    .map((s) => ({
      label: s?.label,
      // Prefer upstream-derived context (more trustworthy than request params)
      region: s?.region ?? null,
      city: s?.city ?? null,
    }))
    .filter((s) => s.label);

  if (!rows.length) return;

  const now = new Date();

  // De-dup by the same key as the unique index: (kind, label_lower, region_lower, city_lower)
  const seen = new Set();
  const payload = [];
  for (const r of rows) {
    const label = normalizeSpace(String(r.label));
    if (!label) continue;

    const labelLower = toLowerOrNullNormalized(label);

    // Fall back to request context only if upstream didn't provide it.
    const regionNorm = normalizeSpace(String(r.region ?? region ?? "")) || null;
    const cityNorm = normalizeSpace(String(r.city ?? city ?? "")) || null;
    const regionLower = toLowerOrNullNormalized(regionNorm);
    const cityLower = toLowerOrNullNormalized(cityNorm);

    const key = JSON.stringify({ kind, labelLower, regionLower, cityLower });
    if (seen.has(key)) continue;
    seen.add(key);

    payload.push({
      kind,
      label,
      labelLower,
      region: regionNorm,
      regionLower,
      city: cityNorm,
      cityLower,
      source: "nominatim",
      lastSeenAt: now,
    });
  }

  if (!payload.length) return;

  // Best-effort persistence.
  // Do NOT rely solely on a DB unique index: it might not exist yet (or might have failed
  // to be created due to historical duplicates). Keep it idempotent at the app layer.
  try {
    for (const row of payload) {
      const existing = await AddressSuggestion.findOne({
        where: {
          kind: row.kind,
          labelLower: row.labelLower,
          regionLower: row.regionLower,
          cityLower: row.cityLower,
        },
      });

      if (existing) {
        await existing.update({
          label: row.label,
          region: row.region,
          city: row.city,
          source: row.source,
          lastSeenAt: row.lastSeenAt,
        });
      } else {
        await AddressSuggestion.create(row);
      }
    }
  } catch {
    // do not fail request if persistence fails
  }
}

function buildNominatimUrl({ kind, q, region, city }) {
  const url = new URL("https://nominatim.openstreetmap.org/search");

  // Limit to Russia
  url.searchParams.set("countrycodes", "ru");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", "10");
  url.searchParams.set("accept-language", "ru");

  if (kind === "region") {
    // Best-effort: search for region/state
    url.searchParams.set("q", `${q}, Россия`);
  } else if (kind === "city") {
    // Use free-text query (less strict than structured city/state params)
    // to avoid over-constraining results when the client passes a wrong region.
    url.searchParams.set("q", `${q}, Россия`);
  } else if (kind === "street") {
    url.searchParams.set("street", q);
    if (city) url.searchParams.set("city", city);
    if (region) url.searchParams.set("state", region);
    url.searchParams.set("country", "Россия");
  } else {
    url.searchParams.set("q", `${q}, Россия`);
  }

  return url.toString();
}

function toSuggestion(item, kind) {
  const address = item?.address || {};

  if (kind === "region") {
    const name =
      address.state ||
      address.region ||
      address.state_district ||
      item?.display_name;
    if (!name) return null;
    const label = normalizeSpace(toSafeText(name, { maxLen: 200 }));
    if (!label) return null;
    return { label };
  }

  if (kind === "city") {
    const name =
      address.city ||
      address.town ||
      address.village ||
      address.hamlet ||
      address.municipality ||
      address.county ||
      item?.name ||
      item?.display_name;
    if (!name) return null;
    const label = normalizeSpace(toSafeText(name, { maxLen: 200 }));
    if (!label) return null;
    const region = normalizeSpace(
      toSafeText(address.state || address.region || address.state_district, {
        maxLen: 200,
      }),
    );
    return { label, region: region || null };
  }

  if (kind === "street") {
    const name =
      address.road || address.pedestrian || address.footway || item?.name;
    if (!name) return null;
    const label = normalizeSpace(toSafeText(name, { maxLen: 200 }));
    if (!label) return null;
    const region = normalizeSpace(
      toSafeText(address.state || address.region || address.state_district, {
        maxLen: 200,
      }),
    );

    const city = normalizeSpace(
      toSafeText(
        address.city ||
          address.town ||
          address.village ||
          address.hamlet ||
          address.municipality,
        { maxLen: 200 },
      ),
    );

    return { label, region: region || null, city: city || null };
  }

  const label = normalizeSpace(toSafeText(item?.display_name, { maxLen: 200 }));
  return label ? { label } : null;
}

async function fetchWithHardTimeout(url, options, timeoutMs) {
  const ac = new AbortController();
  const fetchPromise = fetch(url, { ...options, signal: ac.signal });

  const timeoutPromise = new Promise((_resolve, reject) => {
    const t = setTimeout(() => {
      try {
        ac.abort();
      } catch {
        // ignore
      }
      reject(new Error("timeout"));
    }, timeoutMs);

    // avoid keeping event loop alive just for timer
    if (typeof t?.unref === "function") t.unref();
  });

  try {
    return await Promise.race([fetchPromise, timeoutPromise]);
  } catch (err) {
    // Ensure no unhandled rejections if fetch eventually fails after timeout.
    fetchPromise.catch(() => {});
    throw err;
  }
}

router.get("/suggest", async (req, res) => {
  const kindRaw = String(req.query?.kind || "")
    .trim()
    .toLowerCase();
  const kind = ["region", "city", "street"].includes(kindRaw)
    ? kindRaw
    : "city";

  const q = normalizeQ(req.query?.q);
  if (!q || q.length < 2) return res.json([]);

  const region = normalizeOptional(req.query?.region, 200);
  const city = normalizeOptional(req.query?.city, 200);
  const regionLower = toLowerOrNull(region);
  const cityLower = toLowerOrNull(city);

  // For city suggestions we don't want to over-constrain by region;
  // treat region as a soft hint only.
  const effectiveRegion = kind === "city" ? null : region;
  const effectiveCity = kind === "city" ? null : city;
  const effectiveRegionLower = kind === "city" ? null : regionLower;
  const effectiveCityLower = kind === "city" ? null : cityLower;

  const key = JSON.stringify({
    kind,
    q,
    region: effectiveRegion,
    city: effectiveCity,
  });
  const cached = cacheGet(key);
  if (cached) return res.json(cached);

  // Prefer local DB suggestions to reduce dependency on upstream.
  try {
    const qLower = q.toLowerCase();

    const local = await searchLocal({
      kind,
      qLower,
      regionLower: effectiveRegionLower,
      cityLower: effectiveCityLower,
      limit: 10,
    });
    if (local.length) {
      cacheSet(key, local);
      return res.json(local);
    }

    // If the client passes a wrong region, city suggestions shouldn't appear broken.
    // Retry local search without region filter.
    if (kind === "city" && regionLower) {
      const relaxed = await searchLocal({
        kind,
        qLower,
        regionLower: null,
        cityLower: null,
        limit: 10,
      });
      if (relaxed.length) {
        cacheSet(key, relaxed);
        return res.json(relaxed);
      }
    }
  } catch {
    // If DB is unavailable for some reason, continue with upstream.
  }

  const url = buildNominatimUrl({
    kind,
    q,
    region: effectiveRegion,
    city: effectiveCity,
  });

  try {
    const resp = await fetchWithHardTimeout(
      url,
      {
        method: "GET",
        headers: {
          // Nominatim usage policy expects a User-Agent identifying the app.
          "User-Agent": "ijshub/0.1 (address autocomplete)",
        },
      },
      3500,
    );

    if (!resp.ok) {
      if (process.env.NODE_ENV !== "test") {
        console.warn("address suggest upstream not ok", {
          kind,
          q,
          status: resp?.status ?? null,
        });
      }
      return res.json([]);
    }

    const data = await resp.json();
    const items = asArray(data)
      .map((it) => toSuggestion(it, kind))
      .filter(Boolean);

    // De-dup by label
    const seen = new Set();
    const unique = [];
    for (const it of items) {
      if (seen.has(it.label)) continue;
      seen.add(it.label);
      unique.push(it);
    }

    // Avoid caching empty results; it often happens due to overly specific context
    // and would make subsequent lookups appear broken.
    if (unique.length) cacheSet(key, unique);

    // Best-effort: persist results so next time we can serve from DB.
    storeUpstreamResults({
      kind,
      region: effectiveRegion,
      city: effectiveCity,
      suggestions: unique,
    }).catch(() => {});

    return res.json(unique);
  } catch (err) {
    if (process.env.NODE_ENV !== "test") {
      console.warn("address suggest upstream failed", {
        kind,
        q,
        error: err?.message || String(err),
      });
    }
    // Degrade gracefully: address suggestions are optional UX.
    return res.json([]);
  }
});

module.exports = router;
