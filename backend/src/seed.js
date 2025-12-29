require("dotenv").config();

const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");
const { sequelize } = require("./db");
const {
  User,
  Property,
  PropertyImage,
  Application,
  StatusHistory,
  News,
  NewsImage,
  Event,
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

async function upsertNewsImage(newsId, url, caption) {
  const [img] = await NewsImage.findOrCreate({
    where: { newsId, url },
    defaults: { newsId, url, caption },
  });
  await img.update({ caption });
  return img;
}

async function findOrCreateNewsByTitle(payload) {
  const [news] = await News.findOrCreate({
    where: { title: payload.title },
    defaults: payload,
  });
  await news.update(payload);
  return news;
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function ensureSvg(filePath, title) {
  if (fs.existsSync(filePath)) return;
  ensureDir(path.dirname(filePath));
  const safeTitle = String(title || "image").slice(0, 60);
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#f3f4f6"/>
      <stop offset="1" stop-color="#e5e7eb"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="675" fill="url(#g)"/>
  <rect x="60" y="60" width="1080" height="555" rx="28" fill="#ffffff" opacity="0.75"/>
  <text x="120" y="190" font-family="Arial, sans-serif" font-size="44" font-weight="700" fill="#111827">${safeTitle.replace(
    /[<>]/g,
    ""
  )}</text>
  <text x="120" y="260" font-family="Arial, sans-serif" font-size="22" fill="#374151">Автосгенерированная тестовая картинка (seed)</text>
  <text x="120" y="320" font-family="Arial, sans-serif" font-size="18" fill="#6b7280">${path.basename(
    filePath
  )}</text>
</svg>
`;
  fs.writeFileSync(filePath, svg, "utf8");
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
      developerApproved: true,
      developerRejected: false,
      companyName,
      lastName,
      firstName,
      middleName,
      phone: `+7 900 000-00-${String(i + 1).padStart(2, "0")}`,
    };
  });

  // One pending developer registration for admin approval flow demo
  developers.push({
    email: "pending-dev@test.com",
    role: "developer",
    developerApproved: false,
    developerRejected: false,
    companyName: "СЗ Тест Ожидание",
    lastName: "Тестов",
    firstName: "Ожидает",
    middleName: "Подтверждения",
    phone: "+7 900 999-00-01",
  });

  // Additional mixed-status developers (deterministic via SEED_RANDOM_SEED)
  const extraDevelopersCount = 8;
  for (let i = 0; i < extraDevelopersCount; i++) {
    const lastName = randomChoice(rng, lastNames);
    const firstName = randomChoice(rng, firstNames);
    const middleName = randomChoice(rng, middleNames);
    const companyName = `${randomChoice(rng, companyPrefixes)} ${randomChoice(
      rng,
      companyWords
    )} ${randomChoice(rng, companyWords)}`.replace(/\s+/g, " ");

    // Ensure at least a couple of pending accounts exist
    const developerApproved = i < 2 ? false : rng() < 0.7;
    const email = developerApproved
      ? `dev-extra-${i + 1}@test.com`
      : `dev-pending-${i + 1}@test.com`;

    developers.push({
      email,
      role: "developer",
      developerApproved,
      developerRejected: false,
      companyName,
      lastName,
      firstName,
      middleName,
      phone: `+7 900 777-00-${String(i + 1).padStart(2, "0")}`,
    });
  }

  const agents = Array.from({ length: 12 }).map((_, i) => {
    const lastName = randomChoice(rng, lastNames);
    const firstName = randomChoice(rng, firstNames);
    const middleName = randomChoice(rng, middleNames);
    return {
      email: i === 0 ? "agent@test.com" : `agent${i + 1}@test.com`,
      role: "agent",
      developerApproved: true,
      developerRejected: false,
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
    developerApproved: true,
    developerRejected: false,
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

  const approvedDevelopers = createdDevelopers.filter(
    (d) => d.role === "developer" && d.developerApproved
  );

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
  const registrationTypesList = ["ИЖС", "СНТ", "ЛПХ"];
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

  // Ensure seed SVGs exist (so the UI doesn't show broken images)
  const uploadsRoot = path.join(__dirname, "..", "uploads");
  for (const img of imagePool) {
    if (!img?.url) continue;
    const rel = img.url.replace(/^\/uploads\//, "");
    ensureSvg(path.join(uploadsRoot, rel), img.caption);
  }

  const createdProperties = [];
  for (let i = 0; i < propertiesCount; i++) {
    const dev = randomChoice(
      rng,
      approvedDevelopers.length ? approvedDevelopers : createdDevelopers
    );
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
      registration: randomChoice(rng, registrationTypesList),
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

    const clientFullName = `${randomChoice(rng, lastNames)} ${randomChoice(
      rng,
      firstNames
    )} ${randomChoice(rng, middleNames)}`
      .replace(/\s+/g, " ")
      .trim();
    const clientPhone = `+7 9${randomInt(rng, 10, 99)} ${randomInt(
      rng,
      100,
      999
    )}-${String(randomInt(rng, 0, 99)).padStart(2, "0")}-${String(
      randomInt(rng, 0, 99)
    ).padStart(2, "0")}`;

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
      clientFullName,
      clientPhone,
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

  // News
  const adminUser = await User.findOne({ where: { email: "admin@test.com" } });
  if (adminUser) {
    const newsCount = randomInt(rng, 12, 22);
    const newsTitles = [
      "Запуск нового раздела Новости",
      "Обновление каталога объектов",
      "Новые правила бронирования",
      "Технические работы",
      "Новые застройщики на платформе",
      "Снижение комиссий по ряду объектов",
      "Поддержка загрузки изображений",
      "Обновление интерфейса",
      "Итоги недели",
      "Важное объявление",
    ];

    const newsImagesDir = path.join(uploadsRoot, "news");
    ensureDir(newsImagesDir);

    for (let i = 0; i < newsCount; i++) {
      const baseTitle = randomChoice(rng, newsTitles);
      const title = `${baseTitle} #${i + 1}`;
      const isPublished = rng() < 0.85;
      const publishedAt = isPublished ? daysAgo(randomInt(rng, 0, 25)) : null;
      const subtitle = rng() < 0.6 ? "Короткий подзаголовок" : "";
      const excerpt =
        rng() < 0.7 ? "Краткое описание для карточки новости (seed)." : "";

      const paragraphs = Array.from({ length: randomInt(rng, 3, 7) }).map(
        (_, p) =>
          `Абзац ${
            p + 1
          }. Это тестовый текст новости для демонстрации. Seed: ${seedValue}.`
      );

      const content = paragraphs.join("\n\n");

      const news = await findOrCreateNewsByTitle({
        title,
        subtitle: subtitle || null,
        excerpt: excerpt || null,
        content,
        isPublished,
        publishedAt,
        authorId: adminUser.id,
      });

      // Add 0..3 images. If images are expected but file is missing, generate it.
      const wantImages = rng() < 0.65;
      const count = wantImages ? randomInt(rng, 1, 3) : 0;
      for (let k = 0; k < count; k++) {
        const filename = `seed-news-${news.id}-${k + 1}.svg`;
        const abs = path.join(newsImagesDir, filename);
        ensureSvg(abs, `Новость #${news.id}`);
        await upsertNewsImage(news.id, `/uploads/news/${filename}`, filename);
      }
    }
  }

  // Events
  if (adminUser) {
    const eventCount = randomInt(rng, 18, 36);
    const formats = ["offline", "online", "hybrid"];
    const locationsOffline = [
      "Офис компании",
      "Конференц-зал",
      "Шоурум",
      "Коворкинг",
      "Презентационный зал",
    ];
    const locationsOnline = ["Zoom", "Google Meet", "MS Teams", "Онлайн"];
    const eventTitles = [
      "Обучение по продажам",
      "Встреча с застройщиком",
      "Разбор кейсов",
      "Презентация проекта",
      "Вебинар для агентов",
      "День открытых дверей",
      "Обновления платформы",
      "Юридические нюансы сделок",
    ];

    const eventImagesDir = path.join(uploadsRoot, "events");
    ensureDir(eventImagesDir);

    for (let i = 0; i < eventCount; i++) {
      const isTraining = rng() < 0.6;
      const format = randomChoice(rng, formats);
      const baseTitle = randomChoice(rng, eventTitles);
      const title = `${baseTitle} #${i + 1}`;

      const dayShift = randomInt(rng, -7, 45);
      const startBase = daysFromNow(dayShift);
      const startAt = new Date(startBase);
      startAt.setHours(
        randomInt(rng, 10, 19),
        randomChoice(rng, [0, 0, 15, 30, 45]),
        0,
        0
      );
      const endAt = new Date(
        startAt.getTime() + randomInt(rng, 60, 180) * 60 * 1000
      );

      const location =
        format === "online"
          ? randomChoice(rng, locationsOnline)
          : format === "hybrid"
          ? `${randomChoice(rng, locationsOffline)} + ${randomChoice(
              rng,
              locationsOnline
            )}`
          : randomChoice(rng, locationsOffline);

      const capacity = rng() < 0.75 ? randomInt(rng, 10, 80) : null;

      const wantCover = rng() < 0.8;
      const filename = wantCover ? `seed-event-${i + 1}.svg` : null;
      if (filename) {
        ensureSvg(path.join(eventImagesDir, filename), title);
      }

      await Event.create({
        title,
        description:
          rng() < 0.75
            ? `Описание мероприятия (seed). Формат: ${format}. Seed: ${seedValue}.`
            : null,
        location: location || null,
        format,
        coverImageUrl: filename ? `/uploads/events/${filename}` : null,
        startAt,
        endAt,
        isTraining,
        capacity,
        createdBy: adminUser.id,
      });
    }
  }

  console.log("Seed complete.");
  console.log("Logins:");
  console.log("- agent@test.com / password");
  console.log("- dev1@test.com / password");
  console.log("- dev2@test.com / password");
  console.log("- dev10@test.com / password");
  console.log("- pending-dev@test.com / password (needs admin approval)");
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
