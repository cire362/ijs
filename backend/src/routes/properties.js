const express = require("express");
const router = express.Router();
const asyncHandler = require("../utils/asyncHandler");
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
} = require("../controllers/propertyController");

router.get("/", optionalAuthenticate, asyncHandler(listProperties));
router.get("/:id", asyncHandler(getPropertyById));
router.post(
  "/",
  authenticate,
  allowRoles("developer", "admin"),
  asyncHandler(createProperty)
);
router.patch(
  "/:id",
  authenticate,
  allowRoles("developer", "admin"),
  asyncHandler(updateProperty)
);

module.exports = router;
