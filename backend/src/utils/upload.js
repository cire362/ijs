const path = require("path");
const multer = require("multer");

const avatarsDir = path.join(__dirname, "..", "..", "uploads", "avatars");

function safeFileBaseName(originalname) {
  const base = path.basename(originalname);
  return base.replace(/[^a-zA-Z0-9._-]/g, "_");
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, avatarsDir),
  filename: (req, file, cb) => {
    const safe = safeFileBaseName(file.originalname);
    const ext = path.extname(safe).toLowerCase();
    cb(null, `u${req.user.id}-${Date.now()}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const ok = ["image/jpeg", "image/png", "image/webp"].includes(file.mimetype);
  cb(ok ? null : new Error("Invalid file type"), ok);
};

const uploadAvatar = multer({
  storage,
  fileFilter,
  limits: { fileSize: 2 * 1024 * 1024 },
}).single("avatar");

module.exports = { uploadAvatar };
