const path = require("path");
const multer = require("multer");
const fs = require("fs");
const { parseIntStrict } = require("./validation");

const avatarsDir = path.join(__dirname, "..", "..", "uploads", "avatars");
const propertiesDir = path.join(__dirname, "..", "..", "uploads", "properties");
const propertyDocsDir = path.join(
  __dirname,
  "..",
  "..",
  "uploads",
  "property_docs",
);
const applicationDocsDir = path.join(
  __dirname,
  "..",
  "..",
  "uploads",
  "application_docs",
);
const newsDir = path.join(__dirname, "..", "..", "uploads", "news");
const eventsDir = path.join(__dirname, "..", "..", "uploads", "events");

fs.mkdirSync(avatarsDir, { recursive: true });
fs.mkdirSync(propertiesDir, { recursive: true });
fs.mkdirSync(propertyDocsDir, { recursive: true });
fs.mkdirSync(applicationDocsDir, { recursive: true });
fs.mkdirSync(newsDir, { recursive: true });
fs.mkdirSync(eventsDir, { recursive: true });

function fixUtf8(str) {
  // If string contains chars > 255, it's already Unicode/UTF-8 and certainly not the latin1 corruption
  // which limits chars to 0-255 range.
  for (let i = 0; i < str.length; i++) {
    if (str.charCodeAt(i) > 255) return str;
  }

  try {
    // Attempt to recover UTF-8 from Latin1 (ISO-8859-1) interpretation
    return Buffer.from(str, "latin1").toString("utf8");
  } catch (e) {
    return str;
  }
}

function safeFileBaseName(originalname) {
  const base = path.basename(originalname);
  // Replace only filesystem-unsafe characters and spaces
  return base.replace(/[\\/:*?"<>| \t\n\r]/g, "_");
}

function safeRouteId(v) {
  const id = parseIntStrict(v);
  return id == null ? "0" : String(id);
}

const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, avatarsDir),
  filename: (req, file, cb) => {
    // Fix encoding in place for Controller access later
    file.originalname = fixUtf8(file.originalname);
    const safe = safeFileBaseName(file.originalname);
    const ext = path.extname(safe).toLowerCase();
    cb(null, `u${req.user.id}-${Date.now()}${ext}`);
  },
});

const propertyImagesStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, propertiesDir),
  filename: (req, file, cb) => {
    file.originalname = fixUtf8(file.originalname);
    const id = safeRouteId(req.params.id);
    const safe = safeFileBaseName(file.originalname);
    const ext = path.extname(safe).toLowerCase();
    cb(null, `p${id}-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});

const newsImagesStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, newsDir),
  filename: (req, file, cb) => {
    file.originalname = fixUtf8(file.originalname);
    const id = safeRouteId(req.params.id);
    const safe = safeFileBaseName(file.originalname);
    const ext = path.extname(safe).toLowerCase();
    cb(null, `n${id}-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});

const eventCoverStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, eventsDir),
  filename: (req, file, cb) => {
    file.originalname = fixUtf8(file.originalname);
    const id = safeRouteId(req.params.id);
    const safe = safeFileBaseName(file.originalname);
    const ext = path.extname(safe).toLowerCase();
    cb(null, `e${id}-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});

const propertyDocStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, propertyDocsDir),
  filename: (req, file, cb) => {
    file.originalname = fixUtf8(file.originalname);
    const id = safeRouteId(req.params.id);
    const safe = safeFileBaseName(file.originalname);
    const finalName = `doc-${id}-${Date.now()}-${safe}`;
    cb(null, finalName);
  },
});

const applicationDocStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, applicationDocsDir),
  filename: (req, file, cb) => {
    file.originalname = fixUtf8(file.originalname);
    const id = safeRouteId(req.params.id);
    const safe = safeFileBaseName(file.originalname);
    const finalName = `appdoc-${id}-${Date.now()}-${safe}`;
    cb(null, finalName);
  },
});

const fileFilter = (req, file, cb) => {
  const ok = ["image/jpeg", "image/png", "image/webp"].includes(file.mimetype);
  cb(ok ? null : new Error("Invalid file type"), ok);
};

const docFilter = (req, file, cb) => {
  // Allow PDF, DOC, DOCX, XLS, XLSX, TXT, Images
  const allowed = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/plain",
    "image/jpeg",
    "image/png",
  ];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("File type not allowed"), false);
  }
};

const applicationDocFilter = (req, file, cb) => {
  // Strict: PDF, DOC, DOCX for payout docs
  const allowed = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("File type not allowed"), false);
  }
};

const uploadPropertyDoc = multer({
  storage: propertyDocStorage,
  fileFilter: docFilter,
  limits: { fileSize: 10 * 1024 * 1024 },
}).single("document");

const uploadApplicationDoc = multer({
  storage: applicationDocStorage,
  fileFilter: applicationDocFilter,
  limits: { fileSize: 15 * 1024 * 1024 },
}).single("document");

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
  uploadPropertyDoc,
  uploadApplicationDoc,
};
