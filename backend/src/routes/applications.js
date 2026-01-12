const express = require("express");
const router = express.Router();
const asyncHandler = require("../utils/asyncHandler");
const validate = require("../middleware/validate");
const {
  createApplicationSchema,
  updateClientInfoSchema,
  updateStatusSchema,
  extendDeadlineSchema,
} = require("../validation/applications");
const { authenticate, allowRoles } = require("../middleware/auth");
const {
  listMine,
  listIncoming,
  createApplication,
  updateClientInfo,
  updateStatus,
  extendInitialDeadline,
} = require("../controllers/applicationController");

router.get("/mine", authenticate, allowRoles("agent"), asyncHandler(listMine));
router.get(
  "/incoming",
  authenticate,
  allowRoles("developer", "admin"),
  asyncHandler(listIncoming)
);
router.post(
  "/",
  authenticate,
  allowRoles("agent"),
  validate(createApplicationSchema),
  asyncHandler(createApplication)
);

router.patch(
  "/:id/client",
  authenticate,
  allowRoles("agent"),
  validate(updateClientInfoSchema),
  asyncHandler(updateClientInfo)
);
router.patch(
  "/:id/status",
  authenticate,
  allowRoles("developer", "admin"),
  validate(updateStatusSchema),
  asyncHandler(updateStatus)
);

router.patch(
  "/:id/extend",
  authenticate,
  allowRoles("developer", "admin"),
  validate(extendDeadlineSchema),
  asyncHandler(extendInitialDeadline)
);

module.exports = router;
