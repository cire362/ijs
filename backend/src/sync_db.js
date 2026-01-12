// Script to verify DB sync and force it safely
const { sequelize } = require("./db");
const { ChatMessage, User } = require("./models");

async function checkAndSync() {
  try {
    console.log("Creating/Altering tables...");
    await sequelize.authenticate();
    await sequelize.sync({ alter: true });
    console.log("Database synced successfully.");

    // Check if we have an admin user
    const admin = await User.findOne({ where: { role: "admin" } });
    if (!admin) {
      console.log(
        "No admin user found. Creating one: admin@ijshub.com / password"
      );
      const bcrypt = require("bcryptjs");
      const hashedPassword = await bcrypt.hash("password", 10);
      await User.create({
        email: "admin@ijshub.com",
        password: hashedPassword,
        role: "admin",
        firstName: "Admin",
        lastName: "System",
        phone: "+70000000000",
      });
    } else {
      console.log("Admin user exists:", admin.email);
    }
  } catch (error) {
    console.error("Error syncing database:", error);
  } finally {
    process.exit();
  }
}

checkAndSync();
