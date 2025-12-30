const express = require("express");
const router = express.Router();
const asyncHandler = require("../utils/asyncHandler");
const { requireCsrf } = require("../middleware/csrf");
const {
  register,
  login,
  refresh,
  logout,
  logoutAll,
} = require("../controllers/authController");

router.post("/register", asyncHandler(register));
router.post("/login", asyncHandler(login));
router.post("/refresh", requireCsrf, asyncHandler(refresh));
router.post("/logout", requireCsrf, asyncHandler(logout));
router.post("/logout-all", requireCsrf, asyncHandler(logoutAll));

module.exports = router;
