const { Op } = require("sequelize");
const { Event, EventRegistration, User, Notification } = require("../models");

function normalizeText(v) {
  return String(v || "")
    .trim()
    .replace(/\s+/g, " ");
}

function parsePositiveInt(v, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  const i = Math.floor(n);
  if (i <= 0) return fallback;
  return i;
}

class EventsService {
  async listEvents(query) {
    const q = normalizeText(query.q);
    const trainingOnly =
      query.training === "1" || String(query.training).toLowerCase() === "true";

    const page = parsePositiveInt(query.page, null);
    const limitRaw = parsePositiveInt(query.limit, null);
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

    // Pagination vs List
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

      return {
        items: result.rows,
        total: result.count,
        page,
        limit,
      };
    }

    return Event.findAll({
      where,
      include: [
        { model: User, as: "creator", attributes: ["id", "email", "role"] },
      ],
      order: [
        ["startAt", "ASC"],
        ["createdAt", "DESC"],
      ],
    });
  }

  async createEvent(data, user) {
    const {
      title,
      description,
      location,
      format,
      startAt,
      endAt,
      isTraining,
      maxParticipants,
    } = data;

    // Logic checks beyond schema
    if (endAt && new Date(endAt).getTime() < new Date(startAt).getTime()) {
      throw {
        status: 400,
        message: "Дата окончания должна быть позже даты начала",
      };
    }

    const created = await Event.create({
      title,
      description: description || null,
      location: location || null,
      format: format || null,
      startAt,
      endAt,
      isTraining: !!isTraining,
      capacity: maxParticipants,
      createdBy: user.id,
    });

    return Event.findByPk(created.id, {
      include: [
        { model: User, as: "creator", attributes: ["id", "email", "role"] },
      ],
    });
  }

  async uploadEventCover(id, file) {
    const event = await Event.findByPk(id);
    if (!event) throw { status: 404, message: "Не найдено" };

    if (!file) {
      throw { status: 400, message: "Изображение не загружено" };
    }

    await event.update({ coverImageUrl: `/uploads/events/${file.filename}` });

    return Event.findByPk(event.id, {
      include: [
        { model: User, as: "creator", attributes: ["id", "email", "role"] },
      ],
    });
  }

  async registerForEvent(id, user) {
    const event = await Event.findByPk(id);
    if (!event) throw { status: 404, message: "Не найдено" };

    if (!["agent", "individual"].includes(user.role)) {
      throw { status: 403, message: "Доступ запрещён" };
    }

    const [reg, created] = await EventRegistration.findOrCreate({
      where: { eventId: event.id, agentId: user.id },
      defaults: { eventId: event.id, agentId: user.id, status: "new" },
    });

    if (!created) {
      throw { status: 400, message: "Вы уже записаны на это мероприятие" };
    }

    // Notify all admins
    const admins = await User.findAll({ where: { role: "admin" } });
    const agentName =
      user.fullName ||
      [user.lastName, user.firstName, user.middleName]
        .filter(Boolean)
        .join(" ") ||
      user.email;

    await Notification.bulkCreate(
      admins.map((a) => ({
        userId: a.id,
        type: "event_registration",
        text: `Запись на мероприятие: ${agentName} → «${event.title}»`,
        meta: {
          eventId: event.id,
          registrationId: reg.id,
          agentId: user.id,
        },
      })),
    );

    return reg;
  }

  async listRegistrations(query) {
    // Controller handled optional ID query validation. Here assumes query is raw.
    // If eventId provided...
    let eventId = null;
    if (query.eventId) {
      eventId = Number(query.eventId);
      if (Number.isNaN(eventId)) {
        throw { status: 400, message: "Некорректный eventId" };
      }
    }

    const where = eventId ? { eventId } : undefined;

    return EventRegistration.findAll({
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
  }

  async listMyRegistrations(query, user) {
    if (!["agent", "individual"].includes(user.role)) {
      throw { status: 403, message: "Доступ запрещён" };
    }

    const page = parsePositiveInt(query.page, 1);
    const limit = Math.min(parsePositiveInt(query.limit, 10), 50);
    const offset = (page - 1) * limit;

    const result = await EventRegistration.findAndCountAll({
      where: { agentId: user.id },
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

    return {
      items: result.rows,
      total: result.count,
      page,
      limit,
    };
  }

  async updateRegistrationStatus(id, data) {
    const status = String(data.status || "")
      .trim()
      .toLowerCase();

    // This check is duplicated in schema validation usually, but service should protect itself.
    if (!["approved", "rejected"].includes(status)) {
      throw { status: 400, message: "Некорректный статус" };
    }

    const reg = await EventRegistration.findByPk(id, {
      include: [
        { model: Event, as: "event" },
        {
          model: User,
          as: "agent",
          attributes: ["id", "firstName", "lastName", "middleName", "email"],
        },
      ],
    });
    if (!reg) throw { status: 404, message: "Не найдено" };

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

    return EventRegistration.findByPk(reg.id, {
      include: [
        { model: Event, as: "event" },
        {
          model: User,
          as: "agent",
          attributes: ["id", "firstName", "lastName", "middleName", "email"],
        },
      ],
    });
  }
}

module.exports = new EventsService();
