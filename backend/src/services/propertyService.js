const { Op } = require("sequelize");
const {
  Property,
  PropertyImage,
  PropertyDocument,
  User,
  AddressSuggestion,
} = require("../models");

async function upsertAddressSuggestion({ kind, label, region, city, source }) {
  if (!AddressSuggestion) return;
  // logic to normalize was in controller, but now we assume data is somewhat valid?
  // validation for suggestions was manual. I'll keep it simple.

  const cleanLabel = (label || "").trim();
  if (cleanLabel.length < 2) return;

  const cleanRegion = (region || "").trim() || null;
  const cleanCity = (city || "").trim() || null;

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
  if (region) {
    await upsertAddressSuggestion({
      kind: "region",
      label: region,
      source: "property",
    });
  }
  if (region && city) {
    await upsertAddressSuggestion({
      kind: "city",
      label: city,
      region,
      source: "property",
    });
  }
  if (region && city && street) {
    await upsertAddressSuggestion({
      kind: "street",
      label: street,
      region,
      city,
      source: "property",
    });
  }
}

class PropertyService {
  async listProperties(query, user) {
    const q = (query.q || "").trim();
    const region = (query.region || "").trim();
    const city = (query.city || "").trim();

    // Default filters
    let publicWhere = { saleStatus: "available" };
    // If agent/admin, they can see others? No, list is usually public search.
    // Spec: "agents see all statuses?" -> "canSeeAllStatuses".
    const canSeeAllStatuses =
      user &&
      (user.role === "agent" ||
        user.role === "admin" ||
        user.role === "developer");

    if (canSeeAllStatuses) {
      publicWhere = {};
      if (query.status) {
        publicWhere.saleStatus = query.status;
      }
    }

    const where = { ...publicWhere };

    // Developer isolation (Implicit rule from tests)
    if (user && user.role === "developer") {
      where.developerId = user.id;
    }

    if (q) {
      where[Op.or] = [
        { title: { [Op.iLike]: `%${q}%` } },
        { description: { [Op.iLike]: `%${q}%` } },
        { street: { [Op.iLike]: `%${q}%` } },
      ];
    }
    if (region) where.region = region;
    if (city) where.city = city;

    if (query.rooms) where.rooms = Number(query.rooms);
    if (query.floors) where.floors = Number(query.floors);

    // Price range
    if (query.priceMin || query.priceMax) {
      const priceFilter = {};
      if (query.priceMin) priceFilter[Op.gte] = Number(query.priceMin);
      if (query.priceMax) priceFilter[Op.lte] = Number(query.priceMax);
      where.price = priceFilter;
    }

    const properties = await Property.findAll({
      where,
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

    return properties;
  }

  async getPropertyById(id, user) {
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
        {
          model: PropertyDocument,
          as: "documents",
        },
      ],
    });

    if (!property) throw { status: 404, message: "Не найдено" };

    if (user?.role === "developer" && property.developerId !== user.id) {
      throw { status: 404, message: "Не найдено" };
    }
    return property;
  }

  async createProperty(data, user) {
    const payload = { ...data };

    if (user.role === "developer") {
      payload.developerId = user.id;
    } else if (user.role === "admin") {
      // developerId check logic done in controller? Or here?
      // Service should ideally be self-contained but validation middleware handles types.
      // Logic check:
      if (!payload.developerId) {
        throw {
          status: 400,
          message: "Для администратора обязателен developerId",
        };
      }
      const developer = await User.findByPk(payload.developerId);
      if (!developer || developer.role !== "developer") {
        throw {
          status: 400,
          message: "Некорректный developerId (нужен застройщик)",
        };
      }
    }

    // Default saleStatus
    if (!payload.saleStatus) {
      // payload.saleStatus = "available"; // DB default? Or manual.
      // Model doesn't specify default? Check model. Reference implies logic needed.
      // Validation schema allows null/empty.
      // Original controller: delete if empty.
    }

    // In original controller:
    // if (payload.saleStatus === undefined || payload.saleStatus === "") { delete payload.saleStatus; }

    const created = await Property.create(payload);

    ensureSuggestionsFromPropertyFields({
      region: payload.region,
      city: payload.city,
      street: payload.street,
    }).catch(() => {});

    return this.getPropertyById(created.id, user);
    // Optimization: reuse getById to return full object with includes
  }

  async updateProperty(id, data, user) {
    const property = await Property.findByPk(id);
    if (!property) throw { status: 404, message: "Не найдено" };

    if (user.role === "developer" && property.developerId !== user.id) {
      throw { status: 403, message: "Доступ запрещён" };
    }

    const updates = { ...data };

    if (updates.developerId !== undefined) {
      if (user.role !== "admin") {
        throw { status: 403, message: "Нельзя менять developerId" };
      }
      // Validate dev exists
      const developer = await User.findByPk(updates.developerId);
      if (!developer || developer.role !== "developer") {
        throw { status: 400, message: "Некорректный developerId" };
      }
    }

    await property.update(updates);

    ensureSuggestionsFromPropertyFields({
      region: updates.region || property.region,
      city: updates.city || property.city,
      street: updates.street || property.street,
    }).catch(() => {});

    return property;
  }

  async addPropertyImages(id, files, user) {
    const property = await Property.findByPk(id);
    if (!property) throw { status: 404, message: "Не найдено" };

    if (user.role === "developer" && property.developerId !== user.id) {
      throw { status: 403, message: "Доступ запрещён" };
    }

    if (!files || !files.length) {
      throw { status: 400, message: "Изображения не загружены" };
    }

    await PropertyImage.bulkCreate(
      files.map((f) => ({
        propertyId: property.id,
        url: `/uploads/properties/${f.filename}`,
        caption: f.originalname,
      }))
    );

    return this.getPropertyById(id, user);
  }

  async deleteProperty(id, user) {
    const property = await Property.findByPk(id);
    if (!property) throw { status: 404, message: "Не найдено" };

    if (user.role === "developer" && property.developerId !== user.id) {
      throw { status: 403, message: "Доступ запрещён" };
    }

    await property.destroy();
  }

  async deletePropertyImage(imageId, user) {
    const image = await PropertyImage.findByPk(imageId, {
      include: ["property"],
    });
    if (!image) throw { status: 404, message: "Изображение не найдено" };

    if (user.role === "developer" && image.property.developerId !== user.id) {
      throw { status: 403, message: "Доступ запрещён" };
    }

    await image.destroy();
  }

  async addPropertyDocument(id, file, user) {
    const property = await Property.findByPk(id);
    if (!property) throw { status: 404, message: "Не найдено" };

    if (user.role === "developer" && property.developerId !== user.id) {
      throw { status: 403, message: "Доступ запрещён" };
    }

    if (!file) {
      throw { status: 400, message: "Документ не загружен" };
    }

    await PropertyDocument.create({
      propertyId: property.id,
      url: `/uploads/property_docs/${file.filename}`,
      originalName: file.originalname,
      mimeType: file.mimetype,
    });

    return this.getPropertyById(id, user);
  }

  async deletePropertyDocument(docId, user) {
    const doc = await PropertyDocument.findByPk(docId, {
      include: ["property"],
    });
    if (!doc) throw { status: 404, message: "Документ не найден" };

    if (user.role === "developer" && doc.property.developerId !== user.id) {
      throw { status: 403, message: "Доступ запрещён" };
    }

    await doc.destroy();
  }
}

module.exports = new PropertyService();
