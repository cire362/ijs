const { Op } = require("sequelize");
const { Event, EventRegistration, User, Notification } = require("../models");

function normalizeText(v) {
  return String(v || "")
    .trim()
    .replace(/\s+/g, " ");
}

function parseDate(v) {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function parsePositiveInt(v, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  const i = Math.floor(n);
  if (i <= 0) return fallback;
  return i;
}

const allowedFormats = ["offline", "online", "hybrid"];

async function listEvents(req, res) {
  const q = normalizeText(req.query?.q);
  const trainingOnly =
    req.query?.training === "1" ||
    String(req.query?.training).toLowerCase() === "true";

  const page = parsePositiveInt(req.query?.page, null);
  const limitRaw = parsePositiveInt(req.query?.limit, null);
  const limit = limitRaw ? Math.min(limitRaw, 50) : null;

  const where = {};
  if (trainingOnly) where.isTraining = true;

  if (q) {
    where[Op.or] = [
      { title: { [Op.iLike]: `%${q}%` } },
      { description: { [Op.iLike]: `%${q}%` } },
      { location: { [Op.iLike]: `%${q}%` } },
    ];
  }

  // Backward compatible behavior:
  // - if page/limit are provided -> return { items, total, page, limit }
  // - otherwise -> return plain array
  if (page && limit) {
    const offset = (page - 1) * limit;
    const result = await Event.findAndCountAll({
      where,
      include: [
        { model: User, as: "creator", attributes: ["id", "email", "role"] },
      ],
      order: [
        ["startAt", "ASC"],
        ["createdAt", "DESC"],
      ],
      limit,
      offset,
    });

    return res.json({
      items: result.rows,
      total: result.count,
      page,
      limit,
    });
  }

  const items = await Event.findAll({
    where,
    include: [
      { model: User, as: "creator", attributes: ["id", "email", "role"] },
    ],
    order: [
      ["startAt", "ASC"],
      ["createdAt", "DESC"],
    ],
  });

  return res.json(items);
}

async function createEvent(req, res) {
  const title = normalizeText(req.body?.title);
  const description =
    req.body?.description == null ? "" : String(req.body.description);
  const location = normalizeText(req.body?.location);

  const formatRaw =
    req.body?.format == null
      ? ""
      : String(req.body.format).trim().toLowerCase();
  const format = formatRaw ? formatRaw : null;
  if (format && !allowedFormats.includes(format)) {
    return res.status(400).json({ error: "Некорректный формат" });
  }

  const startAt = parseDate(req.body?.startAt);
  const endAt = parseDate(req.body?.endAt);

  if (!title) return res.status(400).json({ error: "Заголовок обязателен" });
  if (!startAt)
    return res.status(400).json({ error: "Дата начала обязательна" });
  if (endAt && endAt.getTime() < startAt.getTime()) {
    return res
      .status(400)
      .json({ error: "Дата окончания должна быть позже даты начала" });
  }

  const isTraining = !!req.body?.isTraining;
  const capacity =
    req.body?.capacity == null || req.body?.capacity === ""
      ? null
      : Number(req.body.capacity);
  if (capacity != null && (!Number.isFinite(capacity) || capacity <= 0)) {
    return res.status(400).json({ error: "Некорректная вместимость" });
  }

  const created = await Event.create({
    title,
    description: String(description).trim() ? String(description) : null,
    location: location || null,
    format,
    startAt,
    endAt,
    isTraining,
    capacity,
    createdBy: req.user.id,
  });

  const full = await Event.findByPk(created.id, {
    include: [
      { model: User, as: "creator", attributes: ["id", "email", "role"] },
    ],
  });

  return res.status(201).json(full);
}

async function uploadEventCover(req, res) {
  const event = await Event.findByPk(req.params.id);
  if (!event) return res.status(404).json({ error: "Не найдено" });

  if (!req.file) {
    return res.status(400).json({ error: "Изображение не загружено" });
  }

  await event.update({ coverImageUrl: `/uploads/events/${req.file.filename}` });

  const full = await Event.findByPk(event.id, {
    include: [
      { model: User, as: "creator", attributes: ["id", "email", "role"] },
    ],
  });

  return res.status(201).json(full);
}

async function registerForEvent(req, res) {
  const event = await Event.findByPk(req.params.id);
  if (!event) return res.status(404).json({ error: "Не найдено" });

  if (req.user.role !== "agent") {
    return res.status(403).json({ error: "Доступ запрещён" });
  }

  const [reg, created] = await EventRegistration.findOrCreate({
    where: { eventId: event.id, agentId: req.user.id },
    defaults: { eventId: event.id, agentId: req.user.id, status: "new" },
  });

  if (!created) {
    return res
      .status(400)
      .json({ error: "Вы уже записаны на это мероприятие" });
  }

  // Notify all admins
  const admins = await User.findAll({ where: { role: "admin" } });
  const agentName =
    req.user.fullName ||
    [req.user.lastName, req.user.firstName, req.user.middleName]
      .filter(Boolean)
      .join(" ") ||
    req.user.email;

  await Notification.bulkCreate(
    admins.map((a) => ({
      userId: a.id,
      type: "event_registration",
      text: `Запись на мероприятие: ${agentName} → «${event.title}»`,
      meta: {
        eventId: event.id,
        registrationId: reg.id,
        agentId: req.user.id,
      },
    }))
  );

  return res.status(201).json(reg);
}

async function listRegistrations(req, res) {
  const eventId = req.query?.eventId ? Number(req.query.eventId) : null;
  if (req.query?.eventId && !Number.isFinite(eventId)) {
    return res.status(400).json({ error: "Некорректный eventId" });
  }

  const where = eventId ? { eventId } : undefined;

  const items = await EventRegistration.findAll({
    where,
    include: [
      { model: Event, as: "event" },
      {
        model: User,
        as: "agent",
        attributes: ["id", "firstName", "lastName", "middleName", "email"],
      },
    ],
    order: [["createdAt", "DESC"]],
  });

  return res.json(items);
}

async function listMyRegistrations(req, res) {
  if (req.user.role !== "agent") {
    return res.status(403).json({ error: "Доступ запрещён" });
  }

  const page = parsePositiveInt(req.query?.page, 1);
  const limit = Math.min(parsePositiveInt(req.query?.limit, 10), 50);
  const offset = (page - 1) * limit;

  const result = await EventRegistration.findAndCountAll({
    where: { agentId: req.user.id },
    include: [
      { model: Event, as: "event" },
      {
        model: User,
        as: "agent",
        attributes: ["id", "firstName", "lastName", "middleName", "email"],
      },
    ],
    order: [["createdAt", "DESC"]],
    limit,
    offset,
  });

  return res.json({
    items: result.rows,
    total: result.count,
    page,
    limit,
  });
}

async function updateRegistrationStatus(req, res) {
  const status = String(req.body?.status || "")
    .trim()
    .toLowerCase();
  if (!["approved", "rejected"].includes(status)) {
    return res.status(400).json({ error: "Некорректный статус" });
  }

  const reg = await EventRegistration.findByPk(req.params.id, {
    include: [
      { model: Event, as: "event" },
      {
        model: User,
        as: "agent",
        attributes: ["id", "firstName", "lastName", "middleName", "email"],
      },
    ],
  });
  if (!reg) return res.status(404).json({ error: "Не найдено" });

  await reg.update({ status });

  const eventTitle = reg.event?.title || "мероприятие";
  const verb = status === "approved" ? "подтверждена" : "отклонена";

  await Notification.create({
    userId: reg.agentId,
    type: "event_registration_status",
    text: `Ваша заявка на мероприятие «${eventTitle}» ${verb}.`,
    meta: {
      eventId: reg.eventId,
      registrationId: reg.id,
      status,
    },
  });

  const refreshed = await EventRegistration.findByPk(reg.id, {
    include: [
      { model: Event, as: "event" },
      {
        model: User,
        as: "agent",
        attributes: ["id", "firstName", "lastName", "middleName", "email"],
      },
    ],
  });

  return res.json(refreshed);
}

module.exports = {
  listEvents,
  createEvent,
  uploadEventCover,
  registerForEvent,
  listRegistrations,
  listMyRegistrations,
  updateRegistrationStatus,
};
