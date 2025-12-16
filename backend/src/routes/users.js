const express = require("express");
const router = express.Router();
const asyncHandler = require("../utils/asyncHandler");
const { authenticate, allowRoles } = require("../middleware/auth");
const { uploadAvatar } = require("../utils/upload");
const {
  getMe,
  updateMe,
  uploadMyAvatar,
  listDevelopers,
} = require("../controllers/userController");

router.get("/me", authenticate, asyncHandler(getMe));
router.patch("/me", authenticate, asyncHandler(updateMe));
router.post(
  "/me/avatar",
  authenticate,
  (req, res, next) =>
    uploadAvatar(req, res, (err) => (err ? next(err) : next())),
  asyncHandler(uploadMyAvatar)
);

router.get(
  "/developers",
  authenticate,
  allowRoles("admin"),
  asyncHandler(listDevelopers)
);

module.exports = router;
