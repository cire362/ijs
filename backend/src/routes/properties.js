const express = require("express");
const router = express.Router();
const asyncHandler = require("../utils/asyncHandler");
const validate = require("../middleware/validate");
const {
  createPropertySchema,
  updatePropertySchema,
} = require("../validation/properties");
const {
  authenticate,
  optionalAuthenticate,
  allowRoles,
} = require("../middleware/auth");
const {
  listProperties,
  getPropertyById,
  createProperty,
  updateProperty,
  addPropertyImages,
  deleteProperty,
  deletePropertyImage,
  addPropertyDocument,
  deletePropertyDocument,
} = require("../controllers/propertyController");

const { uploadPropertyImages, uploadPropertyDoc } = require("../utils/upload");

router.get("/", optionalAuthenticate, asyncHandler(listProperties));
router.get("/:id", optionalAuthenticate, asyncHandler(getPropertyById));
router.post(
  "/",
  authenticate,
  allowRoles("developer", "admin"),
  validate(createPropertySchema),
  asyncHandler(createProperty)
);
router.patch(
  "/:id",
  authenticate,
  allowRoles("developer", "admin"),
  validate(updatePropertySchema),
  asyncHandler(updateProperty)
);
router.delete(
  "/:id",
  authenticate,
  allowRoles("developer", "admin"),
  asyncHandler(deleteProperty)
);

router.post(
  "/:id/images",
  authenticate,
  allowRoles("developer", "admin"),
  (req, res, next) =>
    uploadPropertyImages(req, res, (err) => (err ? next(err) : next())),
  asyncHandler(addPropertyImages)
);

router.delete(
  "/images/:id",
  authenticate,
  allowRoles("developer", "admin"),
  asyncHandler(deletePropertyImage)
);

router.post(
  "/:id/documents",
  authenticate,
  allowRoles("developer", "admin"),
  (req, res, next) =>
    uploadPropertyDoc(req, res, (err) => (err ? next(err) : next())),
  asyncHandler(addPropertyDocument)
);

router.delete(
  "/documents/:id",
  authenticate,
  allowRoles("developer", "admin"),
  asyncHandler(deletePropertyDocument)
);

module.exports = router;
