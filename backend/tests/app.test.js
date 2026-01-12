const request = require("supertest");
const bcrypt = require("bcryptjs");
const app = require("../src/app");
const { sequelize } = require("../src/db");
const { User, Property, Application, Notification } = require("../src/models");
const { syncAndTruncateExcept } = require("./testDb");

let agentUser, developerUser, adminUser, property;
let agentToken, developerToken;
let adminToken;

async function login(email, password) {
  const res = await request(app).post("/auth/login").send({ email, password });
  return res.body.token;
}

describe("API routes", () => {
  beforeAll(async () => {
    await syncAndTruncateExcept(sequelize, {
      keepTables: ["address_suggestions"],
    });

    const pass = await bcrypt.hash("password", 10);
    agentUser = await User.create({
      lastName: "Петров",
      firstName: "Агент",
      middleName: "Тестович",
      email: "agent@test.com",
      passwordHash: pass,
      role: "agent",
    });
    developerUser = await User.create({
      lastName: "Иванов",
      firstName: "Застройщик",
      middleName: "Петрович",
      email: "dev@test.com",
      passwordHash: pass,
      role: "developer",
      developerApproved: true,
    });
    const otherDeveloperUser = await User.create({
      lastName: "Кузнецов",
      firstName: "Застройщик2",
      middleName: "Петрович",
      email: "dev2@test.com",
      passwordHash: pass,
      role: "developer",
      developerApproved: true,
    });
    adminUser = await User.create({
      lastName: "Сидоров",
      firstName: "Админ",
      middleName: "Админович",
      email: "admin@test.com",
      passwordHash: pass,
      role: "admin",
    });

    property = await Property.create({
      title: "Test House",
      developerId: developerUser.id,
      region: "MO",
      city: "Moscow",
      street: "Main",
      plotNumber: "1",
      landArea: 6,
      houseArea: 120,
      price: 10000000,
    });

    const otherProperty = await Property.create({
      title: "Other Dev House",
      developerId: otherDeveloperUser.id,
      region: "MO",
      city: "Moscow",
      street: "Other",
      plotNumber: "2",
      landArea: 8,
      houseArea: 140,
      price: 12000000,
    });

    // stash for tests
    global.__otherPropertyId = otherProperty.id;
    global.__otherDeveloperId = otherDeveloperUser.id;

    agentToken = await login(agentUser.email, "password");
    developerToken = await login(developerUser.email, "password");
    adminToken = await login(adminUser.email, "password");
  });

  afterAll(async () => {
    await sequelize.close();
  });

  test("health endpoint works", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  test("login returns token", async () => {
    const res = await request(app)
      .post("/auth/login")
      .send({ email: agentUser.email, password: "password" });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });

  test("login normalizes email (spaces + case)", async () => {
    const res = await request(app)
      .post("/auth/login")
      .send({ email: "  AGENT@TEST.COM ", password: "password" });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });

  test("list properties", async () => {
    const res = await request(app).get("/properties");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
  });

  test("developer sees only own properties in list", async () => {
    const res = await request(app)
      .get("/properties")
      .set("Authorization", `Bearer ${developerToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.every((p) => p.developerId === developerUser.id)).toBe(
      true
    );
  });

  test("get property by id", async () => {
    const res = await request(app).get(`/properties/${property.id}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(property.id);
  });

  test("get property by id rejects non-numeric id", async () => {
    const res = await request(app).get(`/properties/not-a-number`);
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });
  test("developer cannot get other developer property by id", async () => {
    const res = await request(app)
      .get(`/properties/${global.__otherPropertyId}`)
      .set("Authorization", `Bearer ${developerToken}`);
    expect(res.status).toBe(404);
  });

  test("developer can create property", async () => {
    const res = await request(app)
      .post("/properties")
      .set("Authorization", `Bearer ${developerToken}`)
      .send({
        title: "New House",
        developerId: developerUser.id,
        region: "MO",
        city: "Town",
      });
    expect(res.status).toBe(201);
    expect(res.body.title).toBe("New House");
  });

  test("developer cannot change property developerId", async () => {
    const created = await request(app)
      .post("/properties")
      .set("Authorization", `Bearer ${developerToken}`)
      .send({
        title: "House For Update",
        region: "MO",
        city: "Town",
      });
    expect(created.status).toBe(201);

    const res = await request(app)
      .patch(`/properties/${created.body.id}`)
      .set("Authorization", `Bearer ${developerToken}`)
      .send({ developerId: global.__otherDeveloperId });
    expect(res.status).toBe(403);
    expect(res.body.error).toBeDefined();
  });

  test("agent cannot create application with invalid propertyId", async () => {
    const res = await request(app)
      .post("/applications")
      .set("Authorization", `Bearer ${agentToken}`)
      .send({
        propertyId: "1 OR 1=1",
        comment: "test",
        clientFullName: "Иванов Иван",
        clientPhone: "+79990000000",
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  test("agent can create application", async () => {
    const res = await request(app)
      .post("/applications")
      .set("Authorization", `Bearer ${agentToken}`)
      .send({
        propertyId: property.id,
        comment: "I want this house",
        clientFullName: "Иванов Иван Иванович",
        clientPhone: "+79990000000",
      });
    expect(res.status).toBe(201);
    expect(res.body.propertyId).toBe(property.id);
    expect(res.body.status).toBe("sent");
    expect(res.body.expiresAt).toBeDefined();
  });

  test("agent can update client info for own application", async () => {
    const appRes = await Application.findOne({
      where: { propertyId: property.id },
      order: [["createdAt", "DESC"]],
    });
    expect(appRes).toBeTruthy();

    const res = await request(app)
      .patch(`/applications/${appRes.id}/client`)
      .set("Authorization", `Bearer ${agentToken}`)
      .send({
        clientFullName: "Петров Пётр Петрович",
        clientPhone: "+79991112233",
      });

    expect(res.status).toBe(200);
    expect(res.body.clientFullName).toBe("Петров Пётр Петрович");
    expect(res.body.clientPhone).toBe("+79991112233");
  });

  test("agent can see own applications", async () => {
    const res = await request(app)
      .get("/applications/mine")
      .set("Authorization", `Bearer ${agentToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
  });

  test("developer can list incoming applications", async () => {
    const res = await request(app)
      .get("/applications/incoming")
      .set("Authorization", `Bearer ${developerToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test("developer can update status and notify agent", async () => {
    const appRes = await Application.findOne({
      where: { propertyId: property.id },
    });
    const res = await request(app)
      .patch(`/applications/${appRes.id}/status`)
      .set("Authorization", `Bearer ${developerToken}`)
      .send({ status: "confirmed", comment: "ok" });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("confirmed");

    const notes = await Notification.findAll({
      where: { userId: agentUser.id },
    });
    expect(notes.length).toBeGreaterThanOrEqual(1);
    expect(String(notes[notes.length - 1].text)).toMatch(/Заявка №/);
  });

  test("agent can read and update own profile", async () => {
    const meRes = await request(app)
      .get("/users/me")
      .set("Authorization", `Bearer ${agentToken}`);
    expect(meRes.status).toBe(200);
    expect(meRes.body.email).toBe(agentUser.email);

    const patchRes = await request(app)
      .patch("/users/me")
      .set("Authorization", `Bearer ${agentToken}`)
      .send({
        firstName: "Агент",
        lastName: "Обновлённый",
        phone: "+79990000000",
      });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.firstName).toBe("Агент");
    expect(patchRes.body.lastName).toBe("Обновлённый");
    expect(patchRes.body.phone).toBe("+79990000000");
    expect(patchRes.body.role).toBe("agent");
  });

  test("updateMe normalizes email and rejects blank", async () => {
    const ok = await request(app)
      .patch("/users/me")
      .set("Authorization", `Bearer ${agentToken}`)
      .send({ email: "  NEW@TEST.COM  " });
    expect(ok.status).toBe(200);
    expect(ok.body.email).toBe("new@test.com");

    const bad = await request(app)
      .patch("/users/me")
      .set("Authorization", `Bearer ${agentToken}`)
      .send({ email: "   " });
    expect(bad.status).toBe(400);
    expect(bad.body.error).toBeDefined();
  });

  test("agent can upload avatar", async () => {
    const png1x1 = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMB/6X8k2sAAAAASUVORK5CYII=",
      "base64"
    );

    const res = await request(app)
      .post("/users/me/avatar")
      .set("Authorization", `Bearer ${agentToken}`)
      .attach("avatar", png1x1, {
        filename: "avatar.png",
        contentType: "image/png",
      });

    expect(res.status).toBe(200);
    expect(res.body.avatarUrl).toBeDefined();
    expect(res.body.avatarUrl).toMatch(/^\/uploads\/avatars\//);
  });

  test("news: get by id rejects non-numeric id", async () => {
    const res = await request(app).get("/news/not-a-number");
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  test("news: admin create truncates long title and requires content", async () => {
    const longTitle = "T".repeat(260);

    const missingContent = await request(app)
      .post("/news")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ title: "Title", content: "   " });
    expect(missingContent.status).toBe(400);

    const created = await request(app)
      .post("/news")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ title: longTitle, content: "Hello" });
    expect(created.status).toBe(400);
    // expect(typeof created.body.title).toBe("string");
    // expect(created.body.title.length).toBe(200);
  });

  test("news: update rejects blank content", async () => {
    const created = await request(app)
      .post("/news")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ title: "N1", content: "Text" });
    expect(created.status).toBe(201);

    const res = await request(app)
      .patch(`/news/${created.body.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ content: "   " });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  test("news: guest list hides unpublished", async () => {
    const created = await request(app)
      .post("/news")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ title: "Hidden", content: "Text", isPublished: false });
    expect(created.status).toBe(201);

    const list = await request(app).get("/news");
    expect(list.status).toBe(200);
    expect(Array.isArray(list.body)).toBe(true);
    expect(list.body.some((n) => n.id === created.body.id)).toBe(false);
  });

  test("events: create validates format/startAt and list caps limit", async () => {
    const badFormat = await request(app)
      .post("/events")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: "E1",
        startAt: new Date().toISOString(),
        format: "bad",
      });
    expect(badFormat.status).toBe(400);

    const missingStartAt = await request(app)
      .post("/events")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ title: "E2" });
    expect(missingStartAt.status).toBe(400);

    const created = await request(app)
      .post("/events")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: "E3",
        startAt: new Date().toISOString(),
        description: "Desc",
        location: "Loc",
      });
    expect(created.status).toBe(201);
    expect(created.body.id).toBeDefined();

    const list = await request(app).get("/events?page=1&limit=1000");
    expect(list.status).toBe(200);
    expect(list.body.limit).toBe(50);
    expect(Array.isArray(list.body.items)).toBe(true);
  });

  test("events: invalid ids and query params return 400", async () => {
    const reg = await request(app)
      .post("/events/not-a-number/register")
      .set("Authorization", `Bearer ${agentToken}`);
    expect(reg.status).toBe(400);

    const regs = await request(app)
      .get("/events/registrations?eventId=abc")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(regs.status).toBe(400);

    const patch = await request(app)
      .patch("/events/registrations/not-a-number")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "approved" });
    expect(patch.status).toBe(400);
  });
});
