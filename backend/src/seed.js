require("dotenv").config();

const bcrypt = require("bcryptjs");
const { sequelize } = require("./db");
const {
  User,
  Property,
  PropertyImage,
  Application,
  StatusHistory,
} = require("./models");

async function findOrCreateUserByEmail(payload) {
  const [user] = await User.findOrCreate({
    where: { email: payload.email },
    defaults: payload,
  });
  // Ensure updates if it already exists
  await user.update(payload);
  return user;
}

async function findOrCreateProperty(payload) {
  const [prop] = await Property.findOrCreate({
    where: { title: payload.title, developerId: payload.developerId },
    defaults: payload,
  });
  await prop.update(payload);
  return prop;
}

async function upsertImage(propertyId, url, caption) {
  const [img] = await PropertyImage.findOrCreate({
    where: { propertyId, url },
    defaults: { propertyId, url, caption },
  });
  await img.update({ caption });
  return img;
}

function mulberry32(seed) {
  let t = seed >>> 0;
  return function () {
    t += 0x6d2b79f5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function randomInt(rng, min, max) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function randomChoice(rng, list) {
  return list[randomInt(rng, 0, list.length - 1)];
}

function shuffle(rng, arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function daysFromNow(days) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

function daysAgo(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
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
      return "Статус";
  }
}

function calcCommission(price) {
  if (price == null) return null;
  const n = Number(price);
  if (Number.isNaN(n)) return null;
  return Math.round(n * 0.03 * 100) / 100;
}

async function seed() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to seed in production");
  }

  const force = process.env.SEED_FORCE === "1";
  const seedValue = Number(process.env.SEED_RANDOM_SEED || 42);
  const rng = mulberry32(seedValue);

  await sequelize.authenticate();
  await sequelize.sync({ force });

  const passwordHash = await bcrypt.hash("password", 10);

  const lastNames = [
    "Иванов",
    "Петров",
    "Сидоров",
    "Смирнов",
    "Кузнецов",
    "Попов",
    "Васильев",
    "Новиков",
    "Фёдоров",
    "Морозов",
    "Волков",
    "Алексеев",
  ];
  const firstNames = [
    "Алексей",
    "Сергей",
    "Анна",
    "Мария",
    "Ирина",
    "Дмитрий",
    "Илья",
    "Олег",
    "Екатерина",
    "Павел",
  ];
  const middleNames = [
    "Сергеевич",
    "Петрович",
    "Игоревна",
    "Алексеевна",
    "Владимирович",
    "Михайловна",
    "Олегович",
  ];
  const companyPrefixes = ["СЗ", "ГК", "Девелопер", "Строй", "Дом", "ИЖС"];
  const companyWords = [
    "Север",
    "Лес",
    "Озеро",
    "Берег",
    "Сосны",
    "Парк",
    "Горизонт",
    "Эко",
    "Град",
    "Ривьера",
  ];

  const developers = Array.from({ length: 10 }).map((_, i) => {
    const lastName = randomChoice(rng, lastNames);
    const firstName = randomChoice(rng, firstNames);
    const middleName = randomChoice(rng, middleNames);
    const companyName = `${randomChoice(rng, companyPrefixes)} ${randomChoice(
      rng,
      companyWords
    )} ${randomChoice(rng, companyWords)}`.replace(/\s+/g, " ");
    return {
      email: `dev${i + 1}@test.com`,
      role: "developer",
      companyName,
      lastName,
      firstName,
      middleName,
      phone: `+7 900 000-00-${String(i + 1).padStart(2, "0")}`,
    };
  });

  const agents = Array.from({ length: 12 }).map((_, i) => {
    const lastName = randomChoice(rng, lastNames);
    const firstName = randomChoice(rng, firstNames);
    const middleName = randomChoice(rng, middleNames);
    return {
      email: i === 0 ? "agent@test.com" : `agent${i + 1}@test.com`,
      role: "agent",
      companyName: `Агентство ${randomChoice(rng, companyWords)}`,
      lastName,
      firstName,
      middleName,
      phone: `+7 900 100-00-${String(i + 1).padStart(2, "0")}`,
    };
  });

  const admin = {
    email: "admin@test.com",
    role: "admin",
    companyName: "IJSHub",
    lastName: "Сидоров",
    firstName: "Админ",
    middleName: "Админович",
    phone: "+7 900 000-00-99",
  };

  const createdDevelopers = [];
  for (const d of developers) {
    createdDevelopers.push(
      await findOrCreateUserByEmail({
        ...d,
        passwordHash,
        // legacy field for older clients
        name: `${d.lastName} ${d.firstName} ${d.middleName}`.trim(),
      })
    );
  }

  for (const a of agents) {
    await findOrCreateUserByEmail({
      ...a,
      passwordHash,
      name: `${a.lastName} ${a.firstName} ${a.middleName}`.trim(),
    });
  }

  await findOrCreateUserByEmail({
    ...admin,
    passwordHash,
    name: `${admin.lastName} ${admin.firstName} ${admin.middleName}`.trim(),
  });

  const createdAgents = await User.findAll({ where: { role: "agent" } });

  const regions = [
    {
      region: "Московская область",
      cities: ["Истра", "Солнечногорск", "Химки", "Мытищи"],
    },
    {
      region: "Ленинградская область",
      cities: ["Всеволожск", "Сертолово", "Гатчина"],
    },
    { region: "Краснодарский край", cities: ["Краснодар", "Анапа", "Сочи"] },
    { region: "Татарстан", cities: ["Казань", "Набережные Челны"] },
  ];
  const streets = [
    "Берёзовая аллея",
    "Сосновая",
    "Озёрная",
    "Центральная",
    "Лесная",
    "Полевая",
    "Садовая",
  ];
  const finishingTypesList = ["Чистовая", "Предчистовая", "Без отделки"];
  const contractTypesList = ["ДКП", "Договор подряда", "Переуступка"];
  const constructionTypesList = ["Газобетон", "Каркас", "Кирпич", "Брус"];
  const readinessTypesList = [
    "Готовый дом",
    "В строительстве",
    "На этапе коробки",
  ];
  const buildStagesList = [
    "Готов",
    "Отделка",
    "Коробка",
    "Фундамент",
    "Проект",
  ];

  const propertiesCount = 100;
  const imagePool = [
    { url: "/uploads/seed/prop-1-1.svg", caption: "Фасад" },
    { url: "/uploads/seed/prop-1-2.svg", caption: "Участок" },
    { url: "/uploads/seed/prop-2-1.svg", caption: "Экстерьер" },
    { url: "/uploads/seed/prop-3-1.svg", caption: "Визуализация" },
  ];

  const createdProperties = [];
  for (let i = 0; i < propertiesCount; i++) {
    const dev = randomChoice(rng, createdDevelopers);
    const loc = randomChoice(rng, regions);
    const city = randomChoice(rng, loc.cities);
    const landArea = Math.round((rng() * 8 + 4) * 10) / 10; // 4..12
    const houseArea = randomInt(rng, 70, 220);
    const floors = randomChoice(rng, [1, 1, 2, 2, 2, 3]);
    const rooms = Math.min(7, Math.max(2, Math.round(houseArea / 35)));
    const price = randomInt(rng, 6500000, 24000000);

    const payload = {
      title: `КП ${randomChoice(rng, companyWords)} — Дом ${houseArea} #${
        i + 1
      }`,
      developerId: dev.id,
      region: loc.region,
      city,
      street: randomChoice(rng, streets),
      plotNumber: String(randomInt(rng, 1, 80)),
      landArea,
      houseArea,
      floors,
      rooms,
      finishingType: randomChoice(rng, finishingTypesList),
      contractType: randomChoice(rng, contractTypesList),
      constructionType: randomChoice(rng, constructionTypesList),
      readinessType: randomChoice(rng, readinessTypesList),
      saleStatus: "available",
      buildStage: randomChoice(rng, buildStagesList),
      price,
      description: `Дом ${houseArea} м² на участке ${landArea} сот. Проверочное объявление #${
        i + 1
      }.`,
    };

    const prop = await Property.create(payload);
    createdProperties.push(prop);

    const imagesToAdd = shuffle(rng, imagePool).slice(0, randomInt(rng, 1, 3));
    for (const img of imagesToAdd) {
      await upsertImage(prop.id, img.url, img.caption);
    }
  }

  // Applications
  const applicationsCount = 150;
  const reservingStatuses = [
    "confirmed",
    "contract_signed",
    "awaiting_payment",
    "commission_available",
  ];
  const finalStatuses = ["done", "rejected", "expired"];
  const statusWeights = [
    { status: "sent", w: 30 },
    { status: "confirmed", w: 18 },
    { status: "contract_signed", w: 12 },
    { status: "awaiting_payment", w: 10 },
    { status: "commission_available", w: 10 },
    { status: "done", w: 10 },
    { status: "rejected", w: 6 },
    { status: "expired", w: 4 },
  ];

  function weightedStatus() {
    const sum = statusWeights.reduce((acc, x) => acc + x.w, 0);
    let r = rng() * sum;
    for (const x of statusWeights) {
      r -= x.w;
      if (r <= 0) return x.status;
    }
    return "sent";
  }

  const apps = [];
  for (let i = 0; i < applicationsCount; i++) {
    const property = randomChoice(rng, createdProperties);
    const agent = randomChoice(rng, createdAgents);
    let status = weightedStatus();

    // Ensure expired only happens from 'sent' stage
    if (status === "expired") {
      // ok
    }

    const createdAt = daysAgo(randomInt(rng, 0, 25));
    const expiresAt =
      status === "sent"
        ? daysFromNow(7 + randomInt(rng, -2, 10))
        : status === "expired"
        ? daysAgo(randomInt(rng, 1, 10))
        : null;

    const app = await Application.create({
      propertyId: property.id,
      agentId: agent.id,
      status,
      expiresAt,
      commissionAmount: calcCommission(property.price),
      comment: rng() < 0.35 ? "Хочу забронировать объект" : "",
      createdAt,
      updatedAt: createdAt,
    });
    apps.push(app);

    // History
    const flow = [
      "sent",
      "confirmed",
      "contract_signed",
      "awaiting_payment",
      "commission_available",
      "done",
    ];

    const historyEntries = [];
    const sentAt = createdAt;
    historyEntries.push({
      applicationId: app.id,
      status: "sent",
      changedBy: agent.id,
      comment: statusLabelRu("sent"),
      createdAt: sentAt,
      updatedAt: sentAt,
    });

    if (status === "rejected") {
      const t = new Date(sentAt.getTime() + randomInt(rng, 1, 6) * 86400000);
      historyEntries.push({
        applicationId: app.id,
        status: "rejected",
        changedBy: property.developerId,
        comment: statusLabelRu("rejected"),
        createdAt: t,
        updatedAt: t,
      });
    } else if (status === "expired") {
      const t = expiresAt;
      historyEntries.push({
        applicationId: app.id,
        status: "expired",
        changedBy: null,
        comment: statusLabelRu("expired"),
        createdAt: t,
        updatedAt: t,
      });
    } else if (status !== "sent") {
      const idx = flow.indexOf(status);
      let t = new Date(sentAt.getTime());
      for (let s = 1; s <= idx; s++) {
        t = new Date(t.getTime() + randomInt(rng, 1, 5) * 86400000);
        historyEntries.push({
          applicationId: app.id,
          status: flow[s],
          changedBy: property.developerId,
          comment: statusLabelRu(flow[s]),
          createdAt: t,
          updatedAt: t,
        });
      }
    }

    await StatusHistory.bulkCreate(historyEntries);
  }

  // Align property saleStatus with generated applications (one pass)
  const appsByProperty = new Map();
  for (const app of apps) {
    const list = appsByProperty.get(app.propertyId) || [];
    list.push(app);
    appsByProperty.set(app.propertyId, list);
  }

  for (const prop of createdProperties) {
    const list = appsByProperty.get(prop.id) || [];
    const hasDone = list.some((a) => a.status === "done");
    const hasReserving = list.some((a) => reservingStatuses.includes(a.status));
    const nextStatus = hasDone
      ? "sold"
      : hasReserving
      ? "reserved"
      : "available";
    if (prop.saleStatus !== nextStatus) {
      await prop.update({ saleStatus: nextStatus });
    }
  }

  console.log("Seed complete.");
  console.log("Logins:");
  console.log("- agent@test.com / password");
  console.log("- dev1@test.com / password");
  console.log("- dev2@test.com / password");
  console.log("- dev10@test.com / password");
  console.log("- admin@test.com / password");
  console.log("Tip: set SEED_FORCE=1 to recreate tables.");
  console.log("Tip: set SEED_RANDOM_SEED=42 to get deterministic randomness.");
}

seed()
  .then(() => sequelize.close())
  .catch(async (err) => {
    console.error(err);
    try {
      await sequelize.close();
    } catch (_) {}
    process.exit(1);
  });
