const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { User } = require("../models");

const allowedRoles = ["agent", "developer"];
const jwtSecret = process.env.JWT_SECRET || "dev_jwt_secret";

async function register(req, res) {
  try {
    const {
      firstName,
      lastName,
      middleName,
      name,
      email,
      phone,
      password,
      role,
      companyName,
    } = req.body;
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ error: "Invalid role" });
    }
    const exists = await User.findOne({ where: { email } });
    if (exists)
      return res.status(409).json({ error: "Email already registered" });

    const passwordHash = await bcrypt.hash(password, 10);

    // Back-compat: if only legacy name provided, try to split "Фамилия Имя Отчество"
    let derivedLastName = lastName;
    let derivedFirstName = firstName;
    let derivedMiddleName = middleName;
    if ((!derivedLastName || !derivedFirstName) && typeof name === "string") {
      const parts = name.trim().split(/\s+/).filter(Boolean);
      derivedLastName = derivedLastName || parts[0];
      derivedFirstName = derivedFirstName || parts[1];
      derivedMiddleName = derivedMiddleName || parts.slice(2).join(" ");
    }

    const user = await User.create({
      name,
      firstName: derivedFirstName,
      lastName: derivedLastName,
      middleName: derivedMiddleName,
      email,
      phone,
      passwordHash,
      role,
      companyName,
      developerApproved: role === "developer" ? false : true,
    });
    return res
      .status(201)
      .json({ id: user.id, email: user.email, role: user.role });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Registration failed" });
  }
}

async function login(req, res) {
  const { email, password } = req.body;
  const user = await User.findOne({ where: { email } });
  if (!user) return res.status(401).json({ error: "Invalid credentials" });
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return res.status(401).json({ error: "Invalid credentials" });

  const token = jwt.sign({ sub: user.id, role: user.role }, jwtSecret, {
    expiresIn: "1d",
  });
  return res.json({
    token,
    user: {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      middleName: user.middleName,
      fullName: user.fullName,
      role: user.role,
      developerApproved: user.developerApproved,
      avatarUrl: user.avatarUrl,
    },
  });
}

module.exports = { register, login };
