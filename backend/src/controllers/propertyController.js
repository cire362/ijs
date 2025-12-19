const { Property, PropertyImage, User } = require("../models");

async function listProperties(req, res) {
  const canSeeAllStatuses =
    (req.user?.role === "developer" && req.user?.developerApproved) ||
    req.user?.role === "admin" ||
    req.user?.role === "agent";

  const properties = await Property.findAll({
    where: canSeeAllStatuses ? undefined : { saleStatus: "available" },
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
  const property = await Property.findByPk(req.params.id, {
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

  if (!property) return res.status(404).json({ error: "Not found" });
  return res.json(property);
}

async function createProperty(req, res) {
  try {
    const payload = { ...req.body };

    if (req.user.role === "developer") {
      // Developer can only create for themselves
      payload.developerId = req.user.id;
    } else if (req.user.role === "admin") {
      // Admin must explicitly pick a developer
      if (!payload.developerId) {
        return res
          .status(400)
          .json({ error: "developerId is required for admin" });
      }
      const developer = await User.findByPk(payload.developerId);
      if (!developer || developer.role !== "developer") {
        return res
          .status(400)
          .json({ error: "Invalid developerId (must be developer)" });
      }
    }

    const created = await Property.create(payload);
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
    return res.status(400).json({ error: "Cannot create property" });
  }
}

async function updateProperty(req, res) {
  const property = await Property.findByPk(req.params.id);
  if (!property) return res.status(404).json({ error: "Not found" });
  if (req.user.role === "developer" && property.developerId !== req.user.id) {
    return res.status(403).json({ error: "Forbidden" });
  }
  await property.update(req.body);
  return res.json(property);
}

async function addPropertyImages(req, res) {
  const property = await Property.findByPk(req.params.id);
  if (!property) return res.status(404).json({ error: "Not found" });

  if (req.user.role === "developer" && property.developerId !== req.user.id) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const files = Array.isArray(req.files) ? req.files : [];
  if (!files.length) {
    return res.status(400).json({ error: "No images uploaded" });
  }

  await PropertyImage.bulkCreate(
    files.map((f) => ({
      propertyId: property.id,
      url: `/uploads/properties/${f.filename}`,
      caption: f.originalname || null,
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
