const express = require("express");
const router = express.Router();
const asyncHandler = require("../utils/asyncHandler");
const { authenticate, allowRoles } = require("../middleware/auth");
const {
  listMine,
  listIncoming,
  createApplication,
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
  asyncHandler(createApplication)
);
router.patch(
  "/:id/status",
  authenticate,
  allowRoles("developer", "admin"),
  asyncHandler(updateStatus)
);

router.patch(
  "/:id/extend",
  authenticate,
  allowRoles("developer", "admin"),
  asyncHandler(extendInitialDeadline)
);

module.exports = router;
