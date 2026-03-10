const { Op } = require("sequelize");
const bcrypt = require("bcryptjs");
const { Property, User, Notification } = require("../models");
const { sequelize } = require("../db");

function normalizeSpace(s) {
  if (!s) return s;
  return String(s).replace(/\s+/g, " ").trim();
}

function toPublicUser(user) {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    middleName: user.middleName,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    role: user.role,
    companyName: user.companyName,
    developerApproved: user.developerApproved,
    developerRejected: user.developerRejected,
    avatarUrl: user.avatarUrl,
    legalConsentAcceptedAt: user.legalConsentAcceptedAt,
    legalConsentVersion: user.legalConsentVersion,
    marketingConsentGiven: Boolean(user.marketingConsentGiven),
    marketingConsentAcceptedAt: user.marketingConsentAcceptedAt,
    marketingConsentWithdrawnAt: user.marketingConsentWithdrawnAt,
    marketingConsentVersion: user.marketingConsentVersion,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

class UserService {
  async getMe(user) {
    // Should reload from DB to be fresh? Controller passed req.user from middleware which is fresh.
    // If strict compliance with service layer, fetch by id.
    // Middleware usually fetches. Let's assume passed user is model instance.
    return toPublicUser(user);
  }

  async updateMe(user, data) {
    const allowedFields = [
      "firstName",
      "lastName",
      "middleName",
      "phone",
      "companyName",
      "email",
    ];
    const updates = {};
    for (const key of allowedFields) {
      if (data[key] !== undefined) {
        updates[key] = normalizeSpace(data[key]) || null;
      }
    }

    if (updates.email) {
      const emailNorm = updates.email.toLowerCase();
      if (!emailNorm) {
        throw { status: 400, message: "Email не может быть пустым" };
      }
      updates.email = emailNorm;

      const exists = await User.findOne({ where: { email: updates.email } });
      if (exists && exists.id !== user.id) {
        throw { status: 409, message: "Email уже зарегистрирован" };
      }
    }

    await user.update(updates);
    return toPublicUser(user);
  }

  async uploadMyAvatar(user, file) {
    if (!file) throw { status: 400, message: "Файл не загружен" };
    // Assuming file is valid from controller logic
    const avatarUrl = `/uploads/avatars/${file.filename}`;
    await user.update({ avatarUrl });
    return toPublicUser(user);
  }

  async changeMyPassword(user, currentPassword, newPassword) {
    if (!currentPassword || !newPassword) {
      throw { status: 400, message: "Текущий и новый пароль обязательны" };
    }
    if (newPassword.length < 8) {
      throw { status: 400, message: "Пароль слишком короткий" };
    }

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      throw { status: 400, message: "Текущий пароль неверный" };
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await user.update({ passwordHash });
  }

  async setMyMarketingConsent(user, { accepted, documentVersion }) {
    const decision = Boolean(accepted);
    const now = new Date();

    if (decision) {
      await user.update({
        marketingConsentGiven: true,
        marketingConsentAcceptedAt: now,
        marketingConsentWithdrawnAt: null,
        marketingConsentVersion:
          normalizeSpace(documentVersion) ||
          user.marketingConsentVersion ||
          null,
      });
    } else {
      await user.update({
        marketingConsentGiven: false,
        marketingConsentWithdrawnAt: now,
        marketingConsentVersion:
          normalizeSpace(documentVersion) ||
          user.marketingConsentVersion ||
          null,
      });
    }

    return toPublicUser(user);
  }

  async listDevelopers(query) {
    const q = normalizeSpace(query.q || query.search);
    const status = String(query.status || "").trim();
    const approvedRaw = query.approved;

    const where = { role: "developer" };

    if (status === "pending") {
      where.developerApproved = false;
      where.developerRejected = false;
    } else if (status === "approved") {
      where.developerApproved = true;
    } else if (status === "rejected") {
      where.developerApproved = false;
      where.developerRejected = true;
    } else {
      const approvedFilter =
        approvedRaw == null || approvedRaw === ""
          ? null
          : ["1", "true", 1, true].includes(approvedRaw)
            ? true
            : ["0", "false", 0, false].includes(approvedRaw)
              ? false
              : null;

      if (approvedFilter === false) {
        where.developerApproved = false;
        where.developerRejected = false;
      } else if (approvedFilter === true) {
        where.developerApproved = true;
      }
    }

    if (q) {
      where[Op.or] = [
        { email: { [Op.iLike]: `%${q}%` } },
        { companyName: { [Op.iLike]: `%${q}%` } },
        { firstName: { [Op.iLike]: `%${q}%` } },
        { lastName: { [Op.iLike]: `%${q}%` } },
        { middleName: { [Op.iLike]: `%${q}%` } },
      ];
    }

    const users = await User.findAll({
      where,
      order: [["companyName", "ASC"]],
      limit: 200,
    });
    return users.map(toPublicUser);
  }

  async approveDeveloper(id) {
    const user = await User.findByPk(id);
    if (!user) throw { status: 404, message: "Не найдено" };
    if (user.role !== "developer") {
      throw { status: 400, message: "Пользователь не является застройщиком" };
    }

    return sequelize.transaction(async (transaction) => {
      await user.update(
        { developerApproved: true, developerRejected: false },
        { transaction },
      );

      await Notification.create(
        {
          userId: user.id,
          type: "developer_status",
          text: "Ваша регистрация застройщика подтверждена администратором.",
          meta: { developerId: user.id, status: "approved" },
        },
        { transaction },
      );
      return toPublicUser(user);
    });
  }

  async rejectDeveloper(id) {
    const user = await User.findByPk(id);
    if (!user) throw { status: 404, message: "Не найдено" };
    if (user.role !== "developer") {
      throw { status: 400, message: "Пользователь не является застройщиком" };
    }
    if (user.developerApproved) {
      throw { status: 400, message: "Застройщик уже подтверждён" };
    }

    return sequelize.transaction(async (transaction) => {
      await user.update(
        { developerApproved: false, developerRejected: true },
        { transaction },
      );

      await Notification.create(
        {
          userId: user.id,
          type: "developer_status",
          text: "Ваша регистрация застройщика отклонена администратором.",
          meta: { developerId: user.id, status: "rejected" },
        },
        { transaction },
      );
      return toPublicUser(user);
    });
  }

  async deleteDeveloperRequest(id) {
    const user = await User.findByPk(id);
    if (!user) throw { status: 404, message: "Не найдено" };
    if (user.role !== "developer") {
      throw { status: 400, message: "Пользователь не является застройщиком" };
    }
    if (user.developerApproved) {
      throw {
        status: 400,
        message: "Нельзя удалить подтверждённого застройщика",
      };
    }

    const propsCount = await Property.count({
      where: { developerId: user.id },
    });
    if (propsCount > 0) {
      throw { status: 400, message: "Нельзя удалить застройщика с объектами" };
    }

    await user.destroy();
  }

  async createDeveloperByAdmin(data) {
    const {
      firstName,
      lastName,
      middleName,
      name,
      email,
      phone,
      password,
      companyName,
    } = data;

    const emailNorm = normalizeSpace(email || "").toLowerCase();
    if (!emailNorm || !password) {
      throw { status: 400, message: "Email и пароль обязательны" };
    }
    if (!phone) throw { status: 400, message: "Телефон обязателен" };

    const exists = await User.findOne({ where: { email: emailNorm } });
    if (exists) throw { status: 409, message: "Email уже зарегистрирован" };

    const passwordHash = await bcrypt.hash(String(password), 10);

    // Name logic
    let derivedLastName = lastName;
    let derivedFirstName = firstName;
    let derivedMiddleName = middleName;
    if (!derivedLastName || !derivedFirstName) {
      if (name) {
        const parts = name.trim().split(/\s+/).filter(Boolean);
        derivedLastName = derivedLastName || parts[0];
        derivedFirstName = derivedFirstName || parts[1];
        derivedMiddleName = derivedMiddleName || parts.slice(2).join(" ");
      }
    }

    const user = await User.create({
      firstName: derivedFirstName || null,
      lastName: derivedLastName || null,
      middleName: derivedMiddleName || null,
      email: emailNorm,
      phone: normalizeSpace(phone),
      passwordHash,
      role: "developer",
      companyName: normalizeSpace(companyName) || null,
      developerApproved: true,
      developerRejected: false,
    });

    return toPublicUser(user);
  }
}

module.exports = new UserService();
