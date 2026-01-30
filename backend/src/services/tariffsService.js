const { User, Property, TariffPropertyRate } = require("../models");

const CATEGORIES = ["apartments", "commercial", "parking", "storage"];

function ensureIn(value, allowed, fallback) {
  if (allowed.includes(value)) return value;
  return fallback;
}

async function getTariffView({
  category,
  includeInactive = false,
  includeUnapprovedDevelopers = false,
}) {
  const normalizedCategory = ensureIn(
    String(category || ""),
    CATEGORIES,
    "apartments",
  );

  const userWhere = { role: "developer" };
  if (!includeUnapprovedDevelopers) userWhere.developerApproved = true;

  const rateWhere = { category: normalizedCategory };
  if (!includeInactive) rateWhere.isActive = true;

  const developers = await User.findAll({
    where: userWhere,
    order: [
      ["companyName", "ASC"],
      ["lastName", "ASC"],
      ["firstName", "ASC"],
      ["id", "ASC"],
    ],
    include: [
      {
        model: Property,
        as: "properties",
        required: false,
        include: [
          {
            model: TariffPropertyRate,
            as: "tariffRates",
            required: false,
            where: rateWhere,
          },
        ],
      },
    ],
  });

  const payload = developers.map((dev) => {
    const properties = Array.isArray(dev.properties) ? dev.properties : [];
    const displayName = String(
      dev.companyName || dev.fullName || dev.name || dev.email || "",
    ).trim();
    return {
      id: dev.id,
      type: "developer",
      name: displayName,
      isActive: true,
      complexes: properties
        .sort((a, b) => String(a.title).localeCompare(String(b.title)))
        .map((p) => {
          const rates = Array.isArray(p.tariffRates) ? p.tariffRates : [];
          const rate = rates[0] || null;
          return {
            id: p.id,
            name: p.title,
            isActive: true,
            rate: rate
              ? {
                  id: rate.id,
                  category: rate.category,
                  commissionFrom: rate.commissionFrom,
                  commissionTo: rate.commissionTo,
                  notes: rate.notes,
                  isActive: rate.isActive,
                }
              : null,
          };
        }),
    };
  });

  return {
    type: "developer",
    category: normalizedCategory,
    counterparties: payload,
  };
}

module.exports = {
  CATEGORIES,
  ensureIn,
  getTariffView,
  async upsertRate({
    propertyId,
    category,
    commissionFrom,
    commissionTo,
    notes,
    isActive,
  }) {
    const [rate, created] = await TariffPropertyRate.findOrCreate({
      where: { propertyId, category },
      defaults: {
        propertyId,
        category,
        commissionFrom,
        commissionTo,
        notes: notes != null ? String(notes) : null,
        isActive: isActive == null ? true : Boolean(isActive),
      },
    });

    if (!created) {
      rate.commissionFrom = commissionFrom;
      rate.commissionTo = commissionTo;
      rate.notes = notes != null ? String(notes) : null;
      if (isActive != null) rate.isActive = Boolean(isActive);
      await rate.save();
    }

    return rate;
  },
};
