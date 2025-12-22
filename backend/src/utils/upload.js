const path = require("path");
const multer = require("multer");
const fs = require("fs");

const avatarsDir = path.join(__dirname, "..", "..", "uploads", "avatars");
const propertiesDir = path.join(__dirname, "..", "..", "uploads", "properties");
const newsDir = path.join(__dirname, "..", "..", "uploads", "news");
const eventsDir = path.join(__dirname, "..", "..", "uploads", "events");

fs.mkdirSync(avatarsDir, { recursive: true });
fs.mkdirSync(propertiesDir, { recursive: true });
fs.mkdirSync(newsDir, { recursive: true });
fs.mkdirSync(eventsDir, { recursive: true });

function safeFileBaseName(originalname) {
  const base = path.basename(originalname);
  return base.replace(/[^a-zA-Z0-9._-]/g, "_");
}

const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, avatarsDir),
  filename: (req, file, cb) => {
    const safe = safeFileBaseName(file.originalname);
    const ext = path.extname(safe).toLowerCase();
    cb(null, `u${req.user.id}-${Date.now()}${ext}`);
  },
});

const propertyImagesStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, propertiesDir),
  filename: (req, file, cb) => {
    const safe = safeFileBaseName(file.originalname);
    const ext = path.extname(safe).toLowerCase();
    cb(
      null,
      `p${req.params.id}-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`
    );
  },
});

const newsImagesStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, newsDir),
  filename: (req, file, cb) => {
    const safe = safeFileBaseName(file.originalname);
    const ext = path.extname(safe).toLowerCase();
    cb(
      null,
      `n${req.params.id}-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`
    );
  },
});

const eventCoverStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, eventsDir),
  filename: (req, file, cb) => {
    const safe = safeFileBaseName(file.originalname);
    const ext = path.extname(safe).toLowerCase();
    cb(
      null,
      `e${req.params.id}-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`
    );
  },
});

const fileFilter = (req, file, cb) => {
  const ok = ["image/jpeg", "image/png", "image/webp"].includes(file.mimetype);
  cb(ok ? null : new Error("Invalid file type"), ok);
};

const uploadAvatar = multer({
  storage: avatarStorage,
  fileFilter,
  limits: { fileSize: 2 * 1024 * 1024 },
}).single("avatar");

const uploadPropertyImages = multer({
  storage: propertyImagesStorage,
  fileFilter,
  limits: { fileSize: 6 * 1024 * 1024 },
}).array("images", 10);

const uploadNewsImages = multer({
  storage: newsImagesStorage,
  fileFilter,
  limits: { fileSize: 6 * 1024 * 1024 },
}).array("images", 10);

const uploadEventCoverImage = multer({
  storage: eventCoverStorage,
  fileFilter,
  limits: { fileSize: 6 * 1024 * 1024 },
}).single("image");

module.exports = {
  uploadAvatar,
  uploadPropertyImages,
  uploadNewsImages,
  uploadEventCoverImage,
};
