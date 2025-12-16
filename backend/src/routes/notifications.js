const express = require("express");
const router = express.Router();
const asyncHandler = require("../utils/asyncHandler");
const { authenticate } = require("../middleware/auth");
const {
  listNotifications,
  markRead,
} = require("../controllers/notificationController");

router.get("/", authenticate, asyncHandler(listNotifications));
router.post("/:id/read", authenticate, asyncHandler(markRead));

module.exports = router;
