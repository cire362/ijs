const express = require("express");
const router = express.Router();

const asyncHandler = require("../utils/asyncHandler");
const validate = require("../middleware/validate");
const { authenticate, allowRoles } = require("../middleware/auth");
const controller = require("../controllers/tariffsController");
const schemas = require("../validation/tariffs");

// GET /api/tariffs/view?category=apartments
// доступ: все авторизованные
router.get(
  "/view",
  authenticate,
  allowRoles("agent", "developer", "admin"),
  validate(schemas.getTariffViewQuerySchema, "query"),
  asyncHandler(controller.getTariffView),
);

router.get(
  "/admin/view",
  authenticate,
  allowRoles("admin"),
  validate(schemas.getTariffAdminViewQuerySchema, "query"),
  asyncHandler(controller.getTariffAdminView),
);

router.put(
  "/properties/:propertyId/rates/:category",
  authenticate,
  allowRoles("admin"),
  validate(schemas.putRateParamsSchema, "params"),
  validate(schemas.putRateBodySchema),
  asyncHandler(controller.putRate),
);

module.exports = router;
