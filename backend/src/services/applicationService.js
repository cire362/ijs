const { Op } = require("sequelize");
const {
  Application,
  Property,
  StatusHistory,
  Notification,
  User,
  TariffPropertyRate,
} = require("../models");
const { sequelize } = require("../db");
const { formatRuPhone } = require("../utils/phone");

const RESERVING_STATUSES = new Set([
  "confirmed",
  "contract_signed",
  "awaiting_payment",
  "commission_available",
]);

const INITIAL_DEADLINE_DAYS = 7;

function pickActiveTariffRate(property) {
  const rates = Array.isArray(property?.tariffRates)
    ? property.tariffRates
    : [];
  if (!rates.length) return null;
  return rates.find((r) => r?.isActive !== false) || rates[0] || null;
}

function computeCommissionAmount(property) {
  if (!property) return null;
  const rate = pickActiveTariffRate(property);
  if (!rate) return null;
  const percent = Number(rate.commissionFrom);
  if (!Number.isFinite(percent)) return null;
  const price = Number(property.price);
  if (!Number.isFinite(price)) return null;
  return Math.round(price * (percent / 100) * 100) / 100;
}

function applyComputedCommission(app) {
  if (!app) return;
  const computed = computeCommissionAmount(app.property);
  app.setDataValue("commissionAmount", computed);
}

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

function deriveApplicantFullName(user) {
  const fromParts = [user?.lastName, user?.firstName, user?.middleName]
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter(Boolean)
    .join(" ");

  if (fromParts) return fromParts;

  const fromFullName = String(user?.fullName || "").trim();
  if (fromFullName) return fromFullName;

  return String(user?.email || "").trim();
}

class ApplicationService {
  async listMine(user) {
    const apps = await Application.findAll({
      where: { agentId: user.id },
      include: [
        {
          model: Property,
          include: [
            {
              model: TariffPropertyRate,
              as: "tariffRates",
              required: false,
              where: { isActive: true },
            },
          ],
        },
        {
          model: User,
          as: "agent",
          attributes: [
            "id",
            "firstName",
            "lastName",
            "middleName",
            "email",
            "phone",
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
      ],
      order: [["createdAt", "DESC"]],
    });
    apps.forEach(stripDeadlineIfNotSent);
    apps.forEach(applyComputedCommission);
    return apps;
  }

  async listIncoming(query, user) {
    let where = {};
    if (user.role === "developer") {
      where = { "$property.developer_id$": user.id };
    } else if (user.role === "admin" && query.developerId) {
      const developerId = parseInt(query.developerId); // Joi validates types usually, but parsing safety check
      if (!developerId) {
        throw { status: 400, message: "Некорректный developerId" };
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
              model: TariffPropertyRate,
              as: "tariffRates",
              required: false,
              where: { isActive: true },
            },
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
          attributes: [
            "id",
            "firstName",
            "lastName",
            "middleName",
            "email",
            "phone",
          ],
        },
      ],
      order: [["createdAt", "DESC"]],
    });
    apps.forEach(stripDeadlineIfNotSent);
    apps.forEach(applyComputedCommission);
    return apps;
  }

  async createApplication(data, user) {
    const {
      propertyId,
      comment,
      commissionAmount,
      clientFullName,
      clientPhone,
    } = data;

    const property = await Property.findByPk(propertyId, {
      include: [
        {
          model: TariffPropertyRate,
          as: "tariffRates",
          required: false,
          where: { isActive: true },
        },
      ],
    });
    if (!property) throw { status: 404, message: "Объект не найден" };

    if (property.saleStatus && property.saleStatus !== "available") {
      throw { status: 400, message: "Объект недоступен" };
    }

    let computedCommission = computeCommissionAmount(property);
    if (computedCommission == null && commissionAmount != null) {
      computedCommission = commissionAmount;
    }

    const expiresAt = new Date(
      Date.now() + INITIAL_DEADLINE_DAYS * 24 * 60 * 60 * 1000,
    );

    const providedClientFullName = String(clientFullName || "").trim();
    const resolvedClientFullName =
      user.role === "individual"
        ? deriveApplicantFullName(user)
        : providedClientFullName;
    const resolvedClientPhoneSource =
      user.role === "individual" ? user?.phone : clientPhone;
    const normalizedClientPhone = formatRuPhone(resolvedClientPhoneSource);

    if (!resolvedClientFullName) {
      throw {
        status: 400,
        message:
          user.role === "individual"
            ? "Заполните ФИО в профиле"
            : "Укажите ФИО клиента",
      };
    }

    if (!normalizedClientPhone) {
      throw {
        status: 400,
        message:
          user.role === "individual"
            ? "Заполните телефон в профиле"
            : "Некорректный телефон (пример: +7 900 100-00-11 или 8 900 100-00-11)",
      };
    }

    return sequelize.transaction(async (transaction) => {
      const app = await Application.create(
        {
          propertyId,
          agentId: user.id,
          status: "sent",
          expiresAt,
          commissionAmount: computedCommission,
          comment: comment || null,
          clientFullName: resolvedClientFullName,
          clientPhone: normalizedClientPhone,
        },
        { transaction },
      );

      await StatusHistory.create(
        {
          applicationId: app.id,
          status: "sent",
          changedBy: user.id,
          comment: "Заявка отправлена",
        },
        { transaction },
      );

      if (property.developerId) {
        await Notification.create(
          {
            userId: property.developerId,
            type: "application_new",
            text: `Новая заявка №${app.id} по объекту «${property.title}»`,
            meta: {
              applicationId: app.id,
              propertyId: property.id,
              agentId: user.id,
            },
          },
          { transaction },
        );
      }

      const admins = await User.findAll({
        where: { role: "admin" },
        transaction,
      });
      if (admins.length) {
        await Notification.bulkCreate(
          admins.map((a) => ({
            userId: a.id,
            type: "application_new",
            text: `Новая заявка №${app.id} по объекту «${property.title}»`,
            meta: {
              applicationId: app.id,
              propertyId: property.id,
              agentId: user.id,
            },
          })),
          { transaction },
        );
      }

      return app;
    });
  }

  async updateStatus(id, data, user) {
    const { status, comment } = data;

    const app = await Application.findByPk(id, {
      include: [{ model: Property }],
    });
    if (!app) throw { status: 404, message: "Не найдено" };

    if (app.status === "expired") {
      throw { status: 400, message: "Срок заявки истек" };
    }
    if (status === "expired") {
      throw { status: 400, message: "Нельзя установить вручную" };
    }

    // Authorization check
    if (user.role === "developer" && app.property.developerId !== user.id) {
      throw { status: 403, message: "Запрещено" };
    }

    // Logic: Status transitions affecting Property saleStatus
    return sequelize.transaction(async (transaction) => {
      if (status === "done") {
        if (app.property?.saleStatus === "sold" && app.status !== "done") {
          throw { status: 400, message: "Объект уже продан" };
        }
        if (app.property && app.property.saleStatus !== "sold") {
          await app.property.update({ saleStatus: "sold" }, { transaction });
        }
      } else if (RESERVING_STATUSES.has(status)) {
        if (app.property && app.property.saleStatus !== "sold") {
          await app.property.update(
            { saleStatus: "reserved" },
            { transaction },
          );
        }
      } else if (status === "rejected") {
        if (app.property && app.property.saleStatus !== "sold") {
          const activeCount = await Application.count({
            where: {
              propertyId: app.propertyId,
              id: { [Op.ne]: app.id },
              status: { [Op.in]: Array.from(RESERVING_STATUSES) },
            },
            transaction,
          });
          if (activeCount === 0) {
            await app.property.update(
              { saleStatus: "available" },
              { transaction },
            );
          }
        }
      }

      const updates = { status };
      if (status !== "sent") {
        updates.expiresAt = null;
      }
      await app.update(updates, { transaction });

      const effectiveComment = comment || statusLabelRu(status);

      await StatusHistory.create(
        {
          applicationId: app.id,
          status,
          changedBy: user.id,
          comment: effectiveComment,
        },
        { transaction },
      );

      if (app.agentId) {
        await Notification.create(
          {
            userId: app.agentId,
            type: "application_status",
            text: `Заявка №${app.id} обновилась: ${statusLabelRu(status)}`,
            meta: { applicationId: app.id, status },
          },
          { transaction },
        );
      }

      return app;
    });
  }

  // Helper for internal use or controller
  async extendInitialDeadline(id, user) {
    const app = await Application.findByPk(id, {
      include: [{ model: Property }],
    });
    if (!app) throw { status: 404, message: "Не найдено" };

    if (user.role === "developer" && app.property.developerId !== user.id) {
      throw { status: 403, message: "Запрещено" };
    }

    if (app.status !== "sent") {
      throw {
        status: 400,
        message: "Продлить можно только на статусе 'отправлено'",
      };
    }

    const newDeadline = new Date(
      Date.now() + INITIAL_DEADLINE_DAYS * 24 * 60 * 60 * 1000,
    );
    await app.update({ expiresAt: newDeadline });

    return app;
  }

  async updateClientInfo(id, data, user) {
    const app = await Application.findByPk(id);
    if (!app) throw { status: 404, message: "Не найдено" };

    if (app.agentId !== user.id) {
      throw { status: 403, message: "Вы не создатель заявки" };
    }

    const normalizedClientPhone = formatRuPhone(data.clientPhone);
    if (!normalizedClientPhone) {
      throw {
        status: 400,
        message:
          "Некорректный телефон (пример: +7 900 100-00-11 или 8 900 100-00-11)",
      };
    }

    await app.update({
      clientFullName: data.clientFullName,
      clientPhone: normalizedClientPhone,
    });

    return app;
  }
}

module.exports = new ApplicationService();
