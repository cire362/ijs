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

const IMAGE_MIME_EXTENSIONS = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
};

const DOCUMENT_MIME_EXTENSIONS = {
  "application/pdf": [".pdf"],
  "application/msword": [".doc"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [
    ".docx",
  ],
  "application/vnd.ms-excel": [".xls"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
    ".xlsx",
  ],
  "text/plain": [".txt"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
};

const APPLICATION_DOCUMENT_MIME_EXTENSIONS = {
  "application/pdf": [".pdf"],
  "application/msword": [".doc"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [
    ".docx",
  ],
};

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

function fileExtensionFromMime(file, allowedMap) {
  const allowedExtensions = allowedMap[file.mimetype];
  if (!Array.isArray(allowedExtensions) || allowedExtensions.length === 0) {
    return null;
  }
  return allowedExtensions[0];
}

function validateFileAgainstMime(file, allowedMap, errorMessage) {
  file.originalname = fixUtf8(file.originalname);
  const safeName = safeFileBaseName(file.originalname);
  const extension = path.extname(safeName).toLowerCase();
  const allowedExtensions = allowedMap[file.mimetype];

  if (!Array.isArray(allowedExtensions) || allowedExtensions.length === 0) {
    return errorMessage;
  }

  if (!allowedExtensions.includes(extension)) {
    return "Расширение файла не соответствует заявленному MIME-типу";
  }

  return null;
}

const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, avatarsDir),
  filename: (req, file, cb) => {
    const ext = fileExtensionFromMime(file, IMAGE_MIME_EXTENSIONS) || ".bin";
    cb(null, `u${req.user.id}-${Date.now()}${ext}`);
  },
});

const propertyImagesStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, propertiesDir),
  filename: (req, file, cb) => {
    const id = safeRouteId(req.params.id);
    const ext = fileExtensionFromMime(file, IMAGE_MIME_EXTENSIONS) || ".bin";
    cb(null, `p${id}-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});

const newsImagesStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, newsDir),
  filename: (req, file, cb) => {
    const id = safeRouteId(req.params.id);
    const ext = fileExtensionFromMime(file, IMAGE_MIME_EXTENSIONS) || ".bin";
    cb(null, `n${id}-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});

const eventCoverStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, eventsDir),
  filename: (req, file, cb) => {
    const id = safeRouteId(req.params.id);
    const ext = fileExtensionFromMime(file, IMAGE_MIME_EXTENSIONS) || ".bin";
    cb(null, `e${id}-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});

const propertyDocStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, propertyDocsDir),
  filename: (req, file, cb) => {
    const id = safeRouteId(req.params.id);
    const safe = safeFileBaseName(file.originalname);
    const baseName = path.basename(safe, path.extname(safe));
    const ext = fileExtensionFromMime(file, DOCUMENT_MIME_EXTENSIONS) || ".bin";
    const finalName = `doc-${id}-${Date.now()}-${baseName}${ext}`;
    cb(null, finalName);
  },
});

const applicationDocStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, applicationDocsDir),
  filename: (req, file, cb) => {
    const id = safeRouteId(req.params.id);
    const safe = safeFileBaseName(file.originalname);
    const baseName = path.basename(safe, path.extname(safe));
    const ext =
      fileExtensionFromMime(file, APPLICATION_DOCUMENT_MIME_EXTENSIONS) ||
      ".bin";
    const finalName = `appdoc-${id}-${Date.now()}-${baseName}${ext}`;
    cb(null, finalName);
  },
});

const fileFilter = (req, file, cb) => {
  const validationError = validateFileAgainstMime(
    file,
    IMAGE_MIME_EXTENSIONS,
    "Invalid file type",
  );
  cb(validationError ? new Error(validationError) : null, !validationError);
};

const docFilter = (req, file, cb) => {
  const validationError = validateFileAgainstMime(
    file,
    DOCUMENT_MIME_EXTENSIONS,
    "File type not allowed",
  );
  cb(validationError ? new Error(validationError) : null, !validationError);
};

const applicationDocFilter = (req, file, cb) => {
  const validationError = validateFileAgainstMime(
    file,
    APPLICATION_DOCUMENT_MIME_EXTENSIONS,
    "File type not allowed",
  );
  cb(validationError ? new Error(validationError) : null, !validationError);
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
