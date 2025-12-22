const { Op } = require("sequelize");
const { News, NewsImage, User } = require("../models");

function normalizeText(v) {
  return String(v || "")
    .trim()
    .replace(/\s+/g, " ");
}

function toBool(v) {
  if (v === true || v === false) return v;
  if (v == null) return null;
  const s = String(v).toLowerCase().trim();
  if (["1", "true", "yes", "y"].includes(s)) return true;
  if (["0", "false", "no", "n"].includes(s)) return false;
  return null;
}

async function listNews(req, res) {
  const isAdmin = req.user?.role === "admin";

  const q = normalizeText(req.query?.q);
  const where = {};

  if (!isAdmin) {
    where.isPublished = true;
  } else {
    const published = toBool(req.query?.published);
    if (published != null) where.isPublished = published;
  }

  if (q) {
    where[Op.or] = [
      { title: { [Op.iLike]: `%${q}%` } },
      { subtitle: { [Op.iLike]: `%${q}%` } },
      { excerpt: { [Op.iLike]: `%${q}%` } },
      { content: { [Op.iLike]: `%${q}%` } },
    ];
  }

  const items = await News.findAll({
    where,
    include: [
      {
        model: User,
        as: "author",
        attributes: [
          "id",
          "firstName",
          "lastName",
          "middleName",
          "email",
          "role",
        ],
      },
      { model: NewsImage, as: "images", attributes: ["id", "url", "caption"] },
    ],
    order: [
      ["publishedAt", "DESC"],
      ["createdAt", "DESC"],
    ],
  });

  return res.json(items);
}

async function getNewsById(req, res) {
  const isAdmin = req.user?.role === "admin";

  const item = await News.findByPk(req.params.id, {
    include: [
      {
        model: User,
        as: "author",
        attributes: [
          "id",
          "firstName",
          "lastName",
          "middleName",
          "email",
          "role",
        ],
      },
      { model: NewsImage, as: "images", attributes: ["id", "url", "caption"] },
    ],
  });

  if (!item) return res.status(404).json({ error: "Not found" });
  if (!isAdmin && !item.isPublished) {
    return res.status(404).json({ error: "Not found" });
  }

  return res.json(item);
}

async function createNews(req, res) {
  const title = normalizeText(req.body?.title);
  const subtitle = normalizeText(req.body?.subtitle);
  const excerpt = req.body?.excerpt == null ? "" : String(req.body.excerpt);
  const content = req.body?.content == null ? "" : String(req.body.content);

  if (!title) return res.status(400).json({ error: "title is required" });
  if (!String(content).trim())
    return res.status(400).json({ error: "content is required" });

  const isPublished = toBool(req.body?.isPublished);
  const publish = isPublished == null ? true : isPublished;

  const created = await News.create({
    title,
    subtitle: subtitle || null,
    excerpt: String(excerpt).trim() ? String(excerpt) : null,
    content: String(content),
    isPublished: publish,
    publishedAt: publish ? new Date() : null,
    authorId: req.user.id,
  });

  const full = await News.findByPk(created.id, {
    include: [
      {
        model: User,
        as: "author",
        attributes: [
          "id",
          "firstName",
          "lastName",
          "middleName",
          "email",
          "role",
        ],
      },
      { model: NewsImage, as: "images", attributes: ["id", "url", "caption"] },
    ],
  });

  return res.status(201).json(full);
}

async function updateNews(req, res) {
  const item = await News.findByPk(req.params.id);
  if (!item) return res.status(404).json({ error: "Not found" });

  const payload = {};

  if (req.body?.title != null) {
    const t = normalizeText(req.body.title);
    if (!t) return res.status(400).json({ error: "title cannot be empty" });
    payload.title = t;
  }

  if (req.body?.subtitle != null) {
    const s = normalizeText(req.body.subtitle);
    payload.subtitle = s ? s : null;
  }

  if (req.body?.excerpt != null) {
    const e = String(req.body.excerpt);
    payload.excerpt = e.trim() ? e : null;
  }

  if (req.body?.content != null) {
    const c = String(req.body.content);
    if (!c.trim())
      return res.status(400).json({ error: "content cannot be empty" });
    payload.content = c;
  }

  if (req.body?.isPublished != null) {
    const b = toBool(req.body.isPublished);
    if (b == null)
      return res.status(400).json({ error: "Invalid isPublished" });

    payload.isPublished = b;
    if (b && !item.publishedAt) payload.publishedAt = new Date();
    if (!b) payload.publishedAt = null;
  }

  await item.update(payload);
  const full = await News.findByPk(item.id, {
    include: [
      {
        model: User,
        as: "author",
        attributes: [
          "id",
          "firstName",
          "lastName",
          "middleName",
          "email",
          "role",
        ],
      },
      { model: NewsImage, as: "images", attributes: ["id", "url", "caption"] },
    ],
  });

  return res.json(full);
}

async function addNewsImages(req, res) {
  const item = await News.findByPk(req.params.id);
  if (!item) return res.status(404).json({ error: "Not found" });

  const files = Array.isArray(req.files) ? req.files : [];
  if (!files.length) {
    return res.status(400).json({ error: "No images uploaded" });
  }

  await NewsImage.bulkCreate(
    files.map((f) => ({
      newsId: item.id,
      url: `/uploads/news/${f.filename}`,
      caption: f.originalname || null,
    }))
  );

  const full = await News.findByPk(item.id, {
    include: [
      {
        model: User,
        as: "author",
        attributes: [
          "id",
          "firstName",
          "lastName",
          "middleName",
          "email",
          "role",
        ],
      },
      { model: NewsImage, as: "images", attributes: ["id", "url", "caption"] },
    ],
  });

  return res.status(201).json(full);
}

module.exports = {
  listNews,
  getNewsById,
  createNews,
  updateNews,
  addNewsImages,
};
