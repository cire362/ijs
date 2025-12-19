const { DataTypes, Model } = require("sequelize");
const { sequelize } = require("../db");

class User extends Model {}

User.init(
  {
    // Legacy single-field name (kept for backwards compatibility / existing DB rows)
    name: { type: DataTypes.STRING },

    // New split name fields
    lastName: { type: DataTypes.STRING },
    firstName: { type: DataTypes.STRING },
    middleName: { type: DataTypes.STRING },

    // Computed full name for UI
    fullName: {
      type: DataTypes.VIRTUAL,
      get() {
        const parts = [this.lastName, this.firstName, this.middleName]
          .map((v) => (typeof v === "string" ? v.trim() : ""))
          .filter(Boolean);
        if (parts.length) return parts.join(" ");
        return this.name || "";
      },
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: { isEmail: true },
    },
    phone: { type: DataTypes.STRING },
    passwordHash: { type: DataTypes.STRING, allowNull: false },
    role: {
      type: DataTypes.ENUM("agent", "developer", "admin"),
      allowNull: false,
    },
    // For developers: access is blocked until admin approval
    developerApproved: { type: DataTypes.BOOLEAN, defaultValue: false },
    // If admin rejects a developer registration request
    developerRejected: { type: DataTypes.BOOLEAN, defaultValue: false },
    companyName: { type: DataTypes.STRING },
    avatarUrl: { type: DataTypes.STRING },
  },
  { sequelize, modelName: "user" }
);

module.exports = User;
