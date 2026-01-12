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
} = require("../controllers/propertyController");

const { uploadPropertyImages } = require("../utils/upload");

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

router.post(
  "/:id/images",
  authenticate,
  allowRoles("developer", "admin"),
  (req, res, next) =>
    uploadPropertyImages(req, res, (err) => (err ? next(err) : next())),
  asyncHandler(addPropertyImages)
);

module.exports = router;
