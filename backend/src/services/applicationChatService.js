const {
  Application,
  Property,
  ApplicationChatMessage,
  User,
} = require("../models");

function canAccessApplicationChat(app, user) {
  if (!user) return false;
  if (!app) return false;

  if (user.role === "admin") return true;
  if (["agent", "individual"].includes(user.role) && app.agentId === user.id)
    return true;

  return false;
}

function normalizeText(v) {
  const s = String(v ?? "").trim();
  return s.length ? s : "";
}

class ApplicationChatService {
  async listChats(user) {
    if (!user) {
      const err = new Error("Токен отсутствует");
      err.status = 401;
      throw err;
    }
    if (!["admin", "agent", "individual"].includes(user.role)) {
      const err = new Error("Доступ запрещён");
      err.status = 403;
      throw err;
    }

    const appsWhere = {};
    if (["agent", "individual"].includes(user.role)) {
      appsWhere.agentId = user.id;
    }

    const apps = await Application.findAll({
      where: appsWhere,
      include: [
        { model: Property },
        {
          model: User,
          as: "agent",
          attributes: ["id", "firstName", "lastName", "middleName", "email"],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    if (!apps.length) return [];

    const appIds = apps.map((a) => a.id);

    const messages = await ApplicationChatMessage.findAll({
      where: { applicationId: appIds },
      attributes: [
        "applicationId",
        "text",
        "createdAt",
        "attachmentOriginalName",
      ],
      order: [["createdAt", "DESC"]],
    });

    const lastByAppId = new Map();
    for (const m of messages) {
      if (!lastByAppId.has(m.applicationId)) {
        lastByAppId.set(m.applicationId, m);
      }
    }

    return apps.map((app) => {
      const last = lastByAppId.get(app.id) || null;
      const lastText = String(last?.text || "").trim();
      const lastMessage =
        lastText ||
        (last?.attachmentOriginalName
          ? `Файл: ${last.attachmentOriginalName}`
          : "");

      return {
        applicationId: app.id,
        title: app.property?.title || `Заявка №${app.id}`,
        lastMessage: lastMessage || "",
        lastTime: last?.createdAt || app.createdAt,
        agent: app.agent,
      };
    });
  }

  async _getAppForChat(applicationId) {
    const app = await Application.findByPk(applicationId, {
      include: [{ model: Property }],
    });
    return app;
  }

  async listMessages(applicationId, user) {
    const app = await this._getAppForChat(applicationId);
    if (!app) {
      const err = new Error("Заявка не найдена");
      err.status = 404;
      throw err;
    }
    if (!canAccessApplicationChat(app, user)) {
      const err = new Error("Доступ запрещён");
      err.status = 403;
      throw err;
    }

    const messages = await ApplicationChatMessage.findAll({
      where: { applicationId: app.id },
      include: [
        {
          model: User,
          as: "sender",
          attributes: [
            "id",
            "firstName",
            "lastName",
            "middleName",
            "role",
            "email",
          ],
        },
      ],
      order: [["createdAt", "ASC"]],
    });

    return messages;
  }

  async createMessage(applicationId, { text }, file, user) {
    const app = await this._getAppForChat(applicationId);
    if (!app) {
      const err = new Error("Заявка не найдена");
      err.status = 404;
      throw err;
    }
    if (!canAccessApplicationChat(app, user)) {
      const err = new Error("Доступ запрещён");
      err.status = 403;
      throw err;
    }

    const cleanText = normalizeText(text);
    if (!cleanText && !file) {
      const err = new Error("Сообщение не может быть пустым");
      err.status = 400;
      throw err;
    }

    const payload = {
      applicationId: app.id,
      senderId: user.id,
      senderRole: user.role,
      text: cleanText || null,
      attachmentUrl: null,
      attachmentOriginalName: null,
      attachmentMimeType: null,
      attachmentSize: null,
    };

    if (file) {
      payload.attachmentUrl = `/uploads/application_docs/${file.filename}`;
      payload.attachmentOriginalName = file.originalname;
      payload.attachmentMimeType = file.mimetype;
      payload.attachmentSize = file.size;
    }

    const created = await ApplicationChatMessage.create(payload);
    const withSender = await ApplicationChatMessage.findByPk(created.id, {
      include: [
        {
          model: User,
          as: "sender",
          attributes: [
            "id",
            "firstName",
            "lastName",
            "middleName",
            "role",
            "email",
          ],
        },
      ],
    });

    return withSender;
  }
}

module.exports = new ApplicationChatService();
