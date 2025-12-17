const { Op } = require("sequelize");
const {
  Application,
  Property,
  StatusHistory,
  Notification,
  User,
} = require("../models");

const RESERVING_STATUSES = new Set([
  "confirmed",
  "contract_signed",
  "awaiting_payment",
  "commission_available",
]);

const INITIAL_DEADLINE_DAYS = 7;

function stripDeadlineIfNotSent(app) {
  if (!app) return;
  if (app.status !== "sent") {
    app.setDataValue("expiresAt", null);
  }
}

function statusLabelRu(status) {
  switch (status) {
    case "sent":
      return "Заявка отправлена";
    case "confirmed":
      return "Заявка подтверждена";
    case "contract_signed":
      return "Договор заключен";
    case "awaiting_payment":
      return "Ожидание оплаты";
    case "commission_available":
      return "Комиссия доступна";
    case "done":
      return "Завершено";
    case "rejected":
      return "Отклонена";
    case "expired":
      return "Истек срок";
    default:
      return "Статус обновлен";
  }
}

async function listMine(req, res) {
  const apps = await Application.findAll({
    where: { agentId: req.user.id },
    include: [
      { model: Property },
      {
        model: User,
        as: "agent",
        attributes: ["id", "firstName", "lastName", "middleName", "email"],
      },
      {
        model: StatusHistory,
        as: "history",
        include: [
          {
            model: User,
            as: "actor",
            attributes: ["id", "firstName", "lastName", "middleName", "role"],
          },
        ],
      },
    ],
    order: [["createdAt", "DESC"]],
  });
  apps.forEach(stripDeadlineIfNotSent);
  return res.json(apps);
}

async function listIncoming(req, res) {
  let where = {};
  if (req.user.role === "developer") {
    where = { "$property.developer_id$": req.user.id };
  } else if (req.user.role === "admin" && req.query.developerId) {
    const developerId = Number(req.query.developerId);
    if (!Number.isFinite(developerId)) {
      return res.status(400).json({ error: "Invalid developerId" });
    }
    where = { "$property.developer_id$": developerId };
  }

  const apps = await Application.findAll({
    where,
    include: [
      {
        model: Property,
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
              "email",
              "phone",
            ],
          },
        ],
      },
      {
        model: StatusHistory,
        as: "history",
        include: [
          {
            model: User,
            as: "actor",
            attributes: ["id", "firstName", "lastName", "middleName", "role"],
          },
        ],
      },
      {
        model: User,
        as: "agent",
        attributes: ["id", "firstName", "lastName", "middleName", "email"],
      },
    ],
    order: [["createdAt", "DESC"]],
  });
  apps.forEach(stripDeadlineIfNotSent);
  return res.json(apps);
}

async function createApplication(req, res) {
  try {
    const { propertyId, comment, commissionAmount } = req.body;

    const property = await Property.findByPk(propertyId);
    if (!property) return res.status(404).json({ error: "Объект не найден" });
    if (property.saleStatus && property.saleStatus !== "available") {
      return res.status(400).json({ error: "Объект недоступен" });
    }

    let computedCommission = commissionAmount;
    if (computedCommission == null && property.price != null) {
      const price = Number(property.price);
      if (!Number.isNaN(price)) {
        computedCommission = Math.round(price * 0.03 * 100) / 100;
      }
    }

    const expiresAt = new Date(
      Date.now() + INITIAL_DEADLINE_DAYS * 24 * 60 * 60 * 1000
    );

    const app = await Application.create({
      propertyId,
      agentId: req.user.id,
      status: "sent",
      expiresAt,
      commissionAmount: computedCommission,
      comment,
    });
    await StatusHistory.create({
      applicationId: app.id,
      status: "sent",
      changedBy: req.user.id,
      comment: "Заявка отправлена",
    });
    return res.status(201).json(app);
  } catch (err) {
    console.error(err);
    return res.status(400).json({ error: "Не удалось создать заявку" });
  }
}

async function updateStatus(req, res) {
  const { status, comment } = req.body;
  const allowed = [
    "sent",
    "confirmed",
    "contract_signed",
    "awaiting_payment",
    "commission_available",
    "done",
    "rejected",
    "expired",
  ];
  if (!allowed.includes(status))
    return res.status(400).json({ error: "Недопустимый статус" });

  const app = await Application.findByPk(req.params.id, {
    include: [{ model: Property }],
  });
  if (!app) return res.status(404).json({ error: "Не найдено" });

  if (app.status === "expired") {
    return res.status(400).json({ error: "Срок заявки истек" });
  }

  if (status === "expired") {
    return res.status(400).json({ error: "Нельзя установить вручную" });
  }
  if (
    req.user.role === "developer" &&
    app.property.developerId !== req.user.id
  ) {
    return res.status(403).json({ error: "Запрещено" });
  }

  const effectiveComment =
    comment != null && String(comment).trim() ? comment : statusLabelRu(status);

  if (status === "done") {
    if (app.property?.saleStatus === "sold" && app.status !== "done") {
      return res.status(400).json({ error: "Объект уже продан" });
    }
    if (app.property && app.property.saleStatus !== "sold") {
      await app.property.update({ saleStatus: "sold" });
    }
  } else if (RESERVING_STATUSES.has(status)) {
    if (app.property && app.property.saleStatus !== "sold") {
      await app.property.update({ saleStatus: "reserved" });
    }
  } else if (status === "rejected") {
    if (app.property && app.property.saleStatus !== "sold") {
      const activeCount = await Application.count({
        where: {
          propertyId: app.propertyId,
          id: { [Op.ne]: app.id },
          status: { [Op.in]: Array.from(RESERVING_STATUSES) },
        },
      });
      if (activeCount === 0) {
        await app.property.update({ saleStatus: "available" });
      }
    }
  }

  const updates = { status };
  // Дедлайн действует только на этапе отправки (sent).
  // После подтверждения (и любых дальнейших статусов) срок истечения не показываем.
  if (status !== "sent") {
    updates.expiresAt = null;
  }

  await app.update(updates);
  await StatusHistory.create({
    applicationId: app.id,
    status,
    changedBy: req.user.id,
    comment: effectiveComment,
  });
  await Notification.create({
    userId: app.agentId,
    type: "application_status",
    text: `Заявка №${app.id}: ${statusLabelRu(status)}`,
    meta: { applicationId: app.id, status },
  });
  return res.json(app);
}

async function extendInitialDeadline(req, res) {
  const days =
    req.body?.days == null || req.body?.days === ""
      ? INITIAL_DEADLINE_DAYS
      : Number(req.body.days);

  if (!Number.isFinite(days) || days <= 0 || days > 60) {
    return res.status(400).json({ error: "Некорректное количество дней" });
  }

  const app = await Application.findByPk(req.params.id, {
    include: [{ model: Property }],
  });
  if (!app) return res.status(404).json({ error: "Не найдено" });

  if (
    req.user.role === "developer" &&
    app.property?.developerId !== req.user.id
  ) {
    return res.status(403).json({ error: "Запрещено" });
  }

  if (app.status !== "sent") {
    return res
      .status(400)
      .json({ error: "Продлить можно только на этапе отправки" });
  }

  const base = app.expiresAt ? new Date(app.expiresAt) : new Date();
  const now = new Date();
  const from = base.getTime() > now.getTime() ? base : now;
  const newExpiresAt = new Date(from.getTime() + days * 24 * 60 * 60 * 1000);

  await app.update({ expiresAt: newExpiresAt });

  const msg = `Срок продлен до ${newExpiresAt.toLocaleDateString("ru-RU")}`;
  await StatusHistory.create({
    applicationId: app.id,
    status: "sent",
    changedBy: req.user.id,
    comment: msg,
  });
  await Notification.create({
    userId: app.agentId,
    type: "application_status",
    text: `Заявка №${app.id}: ${msg}`,
    meta: { applicationId: app.id, status: "sent", expiresAt: newExpiresAt },
  });

  return res.json(app);
}

module.exports = {
  listMine,
  listIncoming,
  createApplication,
  updateStatus,
  extendInitialDeadline,
};
