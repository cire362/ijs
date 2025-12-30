const { Op } = require("sequelize");
const {
  Property,
  PropertyImage,
  User,
  AddressSuggestion,
} = require("../models");
const {
  requireIdParam,
  parseIntStrict,
  toSafeText,
  normalizeSpace,
} = require("../utils/validation");

const ALLOWED_SALE_STATUSES = new Set(["available", "reserved", "sold"]);

function coerceOptionalNumber(v) {
  if (v == null || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return n;
}

function coerceOptionalInt(v) {
  if (v == null || v === "") return null;
  const n = parseIntStrict(v);
  return n == null ? null : n;
}

function safeShort(v) {
  return normalizeSpace(toSafeText(v, { maxLen: 200 }));
}

function safeMedium(v) {
  return normalizeSpace(toSafeText(v, { maxLen: 500 }));
}

function safeLong(v) {
  return toSafeText(v, { maxLen: 20_000 });
}

async function upsertAddressSuggestion({ kind, label, region, city, source }) {
  if (!AddressSuggestion) return;

  const cleanLabel = normalizeSpace(toSafeText(label, { maxLen: 200 }));
  if (!cleanLabel || cleanLabel.length < 2) return;

  const cleanRegion = region
    ? normalizeSpace(toSafeText(region, { maxLen: 200 }))
    : null;
  const cleanCity = city
    ? normalizeSpace(toSafeText(city, { maxLen: 200 }))
    : null;

  const labelLower = cleanLabel.toLowerCase();
  const regionLower = cleanRegion ? cleanRegion.toLowerCase() : null;
  const cityLower = cleanCity ? cleanCity.toLowerCase() : null;

  const now = new Date();

  const existing = await AddressSuggestion.findOne({
    where: { kind, labelLower, regionLower, cityLower },
  });

  if (existing) {
    await existing.update({
      label: cleanLabel,
      region: cleanRegion,
      city: cleanCity,
      source: source || existing.source,
      lastSeenAt: now,
    });
    return;
  }

  await AddressSuggestion.create({
    kind,
    label: cleanLabel,
    labelLower,
    region: cleanRegion,
    regionLower,
    city: cleanCity,
    cityLower,
    source: source || "property",
    lastSeenAt: now,
  });
}

async function ensureSuggestionsFromPropertyFields({ region, city, street }) {
  const r = safeShort(region);
  const c = safeShort(city);
  const s = safeMedium(street);

  if (r) {
    await upsertAddressSuggestion({
      kind: "region",
      label: r,
      source: "property",
    });
  }
  if (c) {
    await upsertAddressSuggestion({
      kind: "city",
      label: c,
      region: r || null,
      source: "property",
    });
  }
  if (s && r && c) {
    await upsertAddressSuggestion({
      kind: "street",
      label: s,
      region: r,
      city: c,
      source: "property",
    });
  }
}

async function listProperties(req, res) {
  const canSeeAllStatuses =
    (req.user?.role === "developer" && req.user?.developerApproved) ||
    req.user?.role === "admin";

  const isDeveloper = req.user?.role === "developer";

  // Дома: при брони объявление остается в каталоге.
  // Участки: при брони объявление скрываем из каталога.
  // Для гостя/агента показываем: available + reserved(только дома).
  const publicWhere = {
    [Op.or]: [
      { saleStatus: "available" },
      {
        saleStatus: "reserved",
        [Op.or]: [
          { houseArea: { [Op.gt]: 0 } },
          { rooms: { [Op.not]: null } },
          { floors: { [Op.not]: null } },
        ],
      },
    ],
  };

  const properties = await Property.findAll({
    where: isDeveloper
      ? {
          developerId: req.user.id,
          ...(canSeeAllStatuses ? {} : publicWhere),
        }
      : canSeeAllStatuses
      ? undefined
      : publicWhere,
    include: [
      {
        model: User,
        as: "developer",
        attributes: [
          "id",
          "firstName",
          "lastName",
          "middleName",
          "companyName",
        ],
      },
      {
        model: PropertyImage,
        as: "images",
        attributes: ["id", "url", "caption"],
      },
    ],
    order: [["createdAt", "DESC"]],
  });
  return res.json(properties);
}

async function getPropertyById(req, res) {
  const id = requireIdParam(req, res);
  if (id == null) return;

  const property = await Property.findByPk(id, {
    include: [
      {
        model: User,
        as: "developer",
        attributes: [
          "id",
          "firstName",
          "lastName",
          "middleName",
          "companyName",
        ],
      },
      {
        model: PropertyImage,
        as: "images",
        attributes: ["id", "url", "caption"],
      },
    ],
  });

  if (!property) return res.status(404).json({ error: "Не найдено" });

  if (req.user?.role === "developer" && property.developerId !== req.user.id) {
    return res.status(404).json({ error: "Не найдено" });
  }
  return res.json(property);
}

async function createProperty(req, res) {
  try {
    const body = req.body || {};

    const payload = {
      title: safeMedium(body.title),
      region: safeShort(body.region),
      city: safeShort(body.city),
      street: safeMedium(body.street) || null,
      plotNumber: safeShort(body.plotNumber) || null,
      landArea: coerceOptionalNumber(body.landArea),
      houseArea: coerceOptionalNumber(body.houseArea),
      floors: coerceOptionalInt(body.floors),
      rooms: coerceOptionalInt(body.rooms),
      finishingType: safeShort(body.finishingType) || null,
      contractType: safeShort(body.contractType) || null,
      constructionType: safeShort(body.constructionType) || null,
      readinessType: safeShort(body.readinessType) || null,
      registration: safeShort(body.registration) || null,
      saleStatus: body.saleStatus != null ? String(body.saleStatus) : undefined,
      buildStage: safeShort(body.buildStage) || null,
      price: coerceOptionalNumber(body.price),
      description: safeLong(body.description) || null,
    };

    if (!payload.title) {
      return res.status(400).json({ error: "Укажите название" });
    }
    if (!payload.region) {
      return res.status(400).json({ error: "Укажите регион" });
    }
    if (!payload.city) {
      return res.status(400).json({ error: "Укажите город" });
    }

    if (payload.saleStatus === undefined || payload.saleStatus === "") {
      delete payload.saleStatus;
    } else if (!ALLOWED_SALE_STATUSES.has(payload.saleStatus)) {
      return res.status(400).json({ error: "Некорректный saleStatus" });
    }

    if (req.user.role === "developer") {
      // Developer can only create for themselves
      payload.developerId = req.user.id;
    } else if (req.user.role === "admin") {
      // Admin must explicitly pick a developer
      const developerId = parseIntStrict(body.developerId);
      if (!developerId) {
        return res
          .status(400)
          .json({ error: "Для администратора обязателен developerId" });
      }
      payload.developerId = developerId;
      const developer = await User.findByPk(developerId);
      if (!developer || developer.role !== "developer") {
        return res
          .status(400)
          .json({ error: "Некорректный developerId (нужен застройщик)" });
      }
    }

    const created = await Property.create(payload);

    // Best-effort: enrich local suggestions DB based on user-entered address.
    ensureSuggestionsFromPropertyFields({
      region: payload.region,
      city: payload.city,
      street: payload.street,
    }).catch(() => {});

    const property = await Property.findByPk(created.id, {
      include: [
        {
          model: User,
          as: "developer",
          attributes: [
            "id",
            "firstName",
            "lastName",
            "middleName",
            "companyName",
          ],
        },
        {
          model: PropertyImage,
          as: "images",
          attributes: ["id", "url", "caption"],
        },
      ],
    });

    return res.status(201).json(property);
  } catch (err) {
    console.error(err);
    return res.status(400).json({ error: "Не удалось создать объект" });
  }
}

async function updateProperty(req, res) {
  const id = requireIdParam(req, res);
  if (id == null) return;

  const property = await Property.findByPk(id);
  if (!property) return res.status(404).json({ error: "Не найдено" });
  if (req.user.role === "developer" && property.developerId !== req.user.id) {
    return res.status(403).json({ error: "Доступ запрещён" });
  }

  const body = req.body || {};
  const updates = {};

  if (Object.prototype.hasOwnProperty.call(body, "title")) {
    const v = safeMedium(body.title);
    if (!v)
      return res.status(400).json({ error: "Название не может быть пустым" });
    updates.title = v;
  }
  if (Object.prototype.hasOwnProperty.call(body, "region")) {
    const v = safeShort(body.region);
    if (!v)
      return res.status(400).json({ error: "Регион не может быть пустым" });
    updates.region = v;
  }
  if (Object.prototype.hasOwnProperty.call(body, "city")) {
    const v = safeShort(body.city);
    if (!v)
      return res.status(400).json({ error: "Город не может быть пустым" });
    updates.city = v;
  }

  const optStringFields = [
    "street",
    "plotNumber",
    "finishingType",
    "contractType",
    "constructionType",
    "readinessType",
    "registration",
    "buildStage",
  ];
  for (const key of optStringFields) {
    if (Object.prototype.hasOwnProperty.call(body, key)) {
      updates[key] = safeMedium(body[key]) || null;
    }
  }

  const optNumberFields = ["landArea", "houseArea", "price"];
  for (const key of optNumberFields) {
    if (Object.prototype.hasOwnProperty.call(body, key)) {
      const n = coerceOptionalNumber(body[key]);
      if (body[key] != null && body[key] !== "" && n == null) {
        return res.status(400).json({ error: `Некорректное поле ${key}` });
      }
      updates[key] = n;
    }
  }

  const optIntFields = ["floors", "rooms"];
  for (const key of optIntFields) {
    if (Object.prototype.hasOwnProperty.call(body, key)) {
      const n = coerceOptionalInt(body[key]);
      if (body[key] != null && body[key] !== "" && n == null) {
        return res.status(400).json({ error: `Некорректное поле ${key}` });
      }
      updates[key] = n;
    }
  }

  if (Object.prototype.hasOwnProperty.call(body, "description")) {
    updates.description = safeLong(body.description) || null;
  }

  if (Object.prototype.hasOwnProperty.call(body, "saleStatus")) {
    if (body.saleStatus == null || body.saleStatus === "") {
      updates.saleStatus = "available";
    } else {
      const s = String(body.saleStatus);
      if (!ALLOWED_SALE_STATUSES.has(s)) {
        return res.status(400).json({ error: "Некорректный saleStatus" });
      }
      updates.saleStatus = s;
    }
  }

  if (Object.prototype.hasOwnProperty.call(body, "developerId")) {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Нельзя менять developerId" });
    }
    const developerId = parseIntStrict(body.developerId);
    if (!developerId) {
      return res.status(400).json({ error: "Некорректный developerId" });
    }
    const developer = await User.findByPk(developerId);
    if (!developer || developer.role !== "developer") {
      return res
        .status(400)
        .json({ error: "Некорректный developerId (нужен застройщик)" });
    }
    updates.developerId = developerId;
  }

  await property.update(updates);

  // Best-effort: enrich local suggestions DB based on the (possibly updated) address.
  const region = Object.prototype.hasOwnProperty.call(updates, "region")
    ? updates.region
    : property.region;
  const city = Object.prototype.hasOwnProperty.call(updates, "city")
    ? updates.city
    : property.city;
  const street = Object.prototype.hasOwnProperty.call(updates, "street")
    ? updates.street
    : property.street;

  ensureSuggestionsFromPropertyFields({ region, city, street }).catch(() => {});

  return res.json(property);
}

async function addPropertyImages(req, res) {
  const id = requireIdParam(req, res);
  if (id == null) return;

  const property = await Property.findByPk(id);
  if (!property) return res.status(404).json({ error: "Не найдено" });

  if (req.user.role === "developer" && property.developerId !== req.user.id) {
    return res.status(403).json({ error: "Доступ запрещён" });
  }

  const files = Array.isArray(req.files) ? req.files : [];
  if (!files.length) {
    return res.status(400).json({ error: "Изображения не загружены" });
  }

  await PropertyImage.bulkCreate(
    files.map((f) => ({
      propertyId: property.id,
      url: `/uploads/properties/${f.filename}`,
      caption: f.originalname
        ? toSafeText(f.originalname, { maxLen: 255 })
        : null,
    }))
  );

  const full = await Property.findByPk(property.id, {
    include: [
      {
        model: User,
        as: "developer",
        attributes: [
          "id",
          "firstName",
          "lastName",
          "middleName",
          "companyName",
        ],
      },
      {
        model: PropertyImage,
        as: "images",
        attributes: ["id", "url", "caption"],
      },
    ],
  });

  return res.status(201).json(full);
}

module.exports = {
  listProperties,
  getPropertyById,
  createProperty,
  updateProperty,
  addPropertyImages,
};
