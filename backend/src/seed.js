require("dotenv").config();

const bcrypt = require("bcryptjs");
const { sequelize } = require("./db");
const { User, Property, PropertyImage } = require("./models");

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

async function seed() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to seed in production");
  }

  const force = process.env.SEED_FORCE === "1";

  await sequelize.authenticate();
  await sequelize.sync({ force });

  const passwordHash = await bcrypt.hash("password", 10);

  const developers = [
    {
      email: "dev1@test.com",
      role: "developer",
      companyName: "СЗ Северный Дом",
      lastName: "Иванов",
      firstName: "Сергей",
      middleName: "Петрович",
      phone: "+7 900 000-00-01",
    },
    {
      email: "dev2@test.com",
      role: "developer",
      companyName: "ГК Лес&Дом",
      lastName: "Смирнова",
      firstName: "Анна",
      middleName: "Игоревна",
      phone: "+7 900 000-00-02",
    },
  ];

  const agents = [
    {
      email: "agent@test.com",
      role: "agent",
      companyName: "Агентство ИЖС",
      lastName: "Петров",
      firstName: "Алексей",
      middleName: "Сергеевич",
      phone: "+7 900 000-00-10",
    },
  ];

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

  const [dev1, dev2] = createdDevelopers;

  const offers = [
    {
      title: "КП Лесной Берег — Дом 120",
      developerId: dev1.id,
      region: "Московская область",
      city: "Истра",
      street: "Берёзовая аллея",
      plotNumber: "12",
      landArea: 7.5,
      houseArea: 120,
      floors: 2,
      rooms: 4,
      finishingType: "Чистовая",
      contractType: "ДКП",
      constructionType: "Газобетон",
      readinessType: "Готовый дом",
      saleStatus: "available",
      buildStage: "Готов",
      price: 12500000,
      description:
        "Готовый дом 120 м² на участке 7.5 сот. Коммуникации по границе участка. Удобный подъезд.",
      images: [
        { url: "/uploads/seed/prop-1-1.svg", caption: "Фасад" },
        { url: "/uploads/seed/prop-1-2.svg", caption: "Участок" },
      ],
    },
    {
      title: "КП Сосны — Дом 98",
      developerId: dev1.id,
      region: "Московская область",
      city: "Солнечногорск",
      street: "Сосновая",
      plotNumber: "5",
      landArea: 6.0,
      houseArea: 98,
      floors: 1,
      rooms: 3,
      finishingType: "Предчистовая",
      contractType: "Договор подряда",
      constructionType: "Каркас",
      readinessType: "В строительстве",
      saleStatus: "reserved",
      buildStage: "Отделка",
      price: 9900000,
      description:
        "Дом 98 м², одноэтажный, рациональная планировка. Бронь до конца недели.",
      images: [{ url: "/uploads/seed/prop-2-1.svg", caption: "Экстерьер" }],
    },
    {
      title: "КП Озёрный — Дом 160",
      developerId: dev2.id,
      region: "Ленинградская область",
      city: "Всеволожск",
      street: "Озёрная",
      plotNumber: "21",
      landArea: 10.2,
      houseArea: 160,
      floors: 2,
      rooms: 5,
      finishingType: "Без отделки",
      contractType: "ДКП",
      constructionType: "Кирпич",
      readinessType: "На этапе коробки",
      saleStatus: "available",
      buildStage: "Коробка",
      price: 17800000,
      description:
        "Дом 160 м². Стадия: коробка. Возможна рассрочка. Подходит под семейную ипотеку (условия уточняйте).",
      images: [{ url: "/uploads/seed/prop-3-1.svg", caption: "Визуализация" }],
    },
  ];

  for (const offer of offers) {
    const { images, ...payload } = offer;
    const prop = await findOrCreateProperty(payload);

    if (Array.isArray(images)) {
      for (const img of images) {
        await upsertImage(prop.id, img.url, img.caption);
      }
    }
  }

  console.log("Seed complete.");
  console.log("Logins:");
  console.log("- agent@test.com / password");
  console.log("- dev1@test.com / password");
  console.log("- dev2@test.com / password");
  console.log("- admin@test.com / password");
  console.log("Tip: set SEED_FORCE=1 to recreate tables.");
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
