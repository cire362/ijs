const { Op } = require("sequelize");
const { News, NewsImage, User } = require("../models");
const { requireIdParam, toSafeText } = require("../utils/validation");

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

  const q = normalizeText(toSafeText(req.query?.q, { maxLen: 200 }));
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

  const id = requireIdParam(req, res);
  if (id == null) return;

  const item = await News.findByPk(id, {
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

  if (!item) return res.status(404).json({ error: "Не найдено" });
  if (!isAdmin && !item.isPublished) {
    return res.status(404).json({ error: "Не найдено" });
  }

  return res.json(item);
}

async function createNews(req, res) {
  const title = normalizeText(toSafeText(req.body?.title, { maxLen: 200 }));
  const subtitle = normalizeText(
    toSafeText(req.body?.subtitle, { maxLen: 200 })
  );
  const excerpt = toSafeText(req.body?.excerpt, { maxLen: 2000 });
  const content = toSafeText(req.body?.content, { maxLen: 50_000 });

  if (!title) return res.status(400).json({ error: "Заголовок обязателен" });
  if (!String(content).trim())
    return res.status(400).json({ error: "Текст обязателен" });

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
  const id = requireIdParam(req, res);
  if (id == null) return;

  const item = await News.findByPk(id);
  if (!item) return res.status(404).json({ error: "Не найдено" });

  const payload = {};

  if (req.body?.title != null) {
    const t = normalizeText(toSafeText(req.body.title, { maxLen: 200 }));
    if (!t)
      return res.status(400).json({ error: "Заголовок не может быть пустым" });
    payload.title = t;
  }

  if (req.body?.subtitle != null) {
    const s = normalizeText(toSafeText(req.body.subtitle, { maxLen: 200 }));
    payload.subtitle = s ? s : null;
  }

  if (req.body?.excerpt != null) {
    const e = toSafeText(req.body.excerpt, { maxLen: 2000 });
    payload.excerpt = e.trim() ? e : null;
  }

  if (req.body?.content != null) {
    const c = toSafeText(req.body.content, { maxLen: 50_000 });
    if (!c.trim())
      return res.status(400).json({ error: "Текст не может быть пустым" });
    payload.content = c;
  }

  if (req.body?.isPublished != null) {
    const b = toBool(req.body.isPublished);
    if (b == null)
      return res
        .status(400)
        .json({ error: "Некорректное значение isPublished" });

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
  const id = requireIdParam(req, res);
  if (id == null) return;

  const item = await News.findByPk(id);
  if (!item) return res.status(404).json({ error: "Не найдено" });

  const files = Array.isArray(req.files) ? req.files : [];
  if (!files.length) {
    return res.status(400).json({ error: "Изображения не загружены" });
  }

  await NewsImage.bulkCreate(
    files.map((f) => ({
      newsId: item.id,
      url: `/uploads/news/${f.filename}`,
      caption: f.originalname
        ? toSafeText(f.originalname, { maxLen: 255 })
        : null,
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
