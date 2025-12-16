const { Op } = require("sequelize");
const {
  Application,
  Property,
  StatusHistory,
  Notification,
} = require("../models");

function statusLabelRu(status) {
  switch (status) {
    case "expired":
      return "Истек срок";
    default:
      return "Статус обновлен";
  }
}

async function expireSentApplications() {
  const now = new Date();

  const apps = await Application.findAll({
    where: {
      status: "sent",
      expiresAt: { [Op.lte]: now },
    },
    include: [{ model: Property }],
    order: [["createdAt", "ASC"]],
  });

  for (const app of apps) {
    // In case something changed between query and processing
    if (app.status !== "sent") continue;

    await app.update({ status: "expired" });

    await StatusHistory.create({
      applicationId: app.id,
      status: "expired",
      changedBy: null,
      comment: statusLabelRu("expired"),
    });

    await Notification.create({
      userId: app.agentId,
      type: "application_status",
      text: `Заявка №${app.id}: Истек срок`,
      meta: { applicationId: app.id, status: "expired" },
    });

    // Property stays available until confirmed; expiring keeps it available.
    // If it became reserved/sold due to another application, we do nothing.
  }

  return { processed: apps.length };
}

module.exports = { expireSentApplications };
