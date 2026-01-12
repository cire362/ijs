const express = require("express");
const router = express.Router();
const asyncHandler = require("../utils/asyncHandler");
const { requireCsrf } = require("../middleware/csrf");
const validate = require("../middleware/validate");
const { registerSchema, loginSchema } = require("../validation/auth");
const {
  register,
  login,
  refresh,
  logout,
  logoutAll,
} = require("../controllers/authController");

router.post("/register", validate(registerSchema), asyncHandler(register));
router.post("/login", validate(loginSchema), asyncHandler(login));
router.post("/refresh", requireCsrf, asyncHandler(refresh));
router.post("/logout", requireCsrf, asyncHandler(logout));
router.post("/logout-all", requireCsrf, asyncHandler(logoutAll));

module.exports = router;
