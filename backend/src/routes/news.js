const express = require("express");
const router = express.Router();
const asyncHandler = require("../utils/asyncHandler");
const validate = require("../middleware/validate");
const { createNewsSchema, updateNewsSchema } = require("../validation/news");
const {
  authenticate,
  optionalAuthenticate,
  allowRoles,
} = require("../middleware/auth");
const {
  listNews,
  getNewsById,
  createNews,
  updateNews,
  addNewsImages,
} = require("../controllers/newsController");

const { uploadNewsImages } = require("../utils/upload");

router.get("/", optionalAuthenticate, asyncHandler(listNews));
router.get("/:id", optionalAuthenticate, asyncHandler(getNewsById));

router.post(
  "/",
  authenticate,
  allowRoles("admin"),
  validate(createNewsSchema),
  asyncHandler(createNews)
);
router.patch(
  "/:id",
  authenticate,
  allowRoles("admin"),
  validate(updateNewsSchema),
  asyncHandler(updateNews)
);

router.post(
  "/:id/images",
  authenticate,
  allowRoles("admin"),
  (req, res, next) =>
    uploadNewsImages(req, res, (err) => (err ? next(err) : next())),
  asyncHandler(addNewsImages)
);

module.exports = router;
