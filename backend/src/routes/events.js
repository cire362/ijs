const express = require("express");
const router = express.Router();
const asyncHandler = require("../utils/asyncHandler");
const {
  authenticate,
  optionalAuthenticate,
  allowRoles,
} = require("../middleware/auth");
const {
  listEvents,
  createEvent,
  uploadEventCover,
  registerForEvent,
  listRegistrations,
  listMyRegistrations,
  updateRegistrationStatus,
} = require("../controllers/eventsController");

const { uploadEventCoverImage } = require("../utils/upload");

router.get("/", optionalAuthenticate, asyncHandler(listEvents));

router.post("/", authenticate, allowRoles("admin"), asyncHandler(createEvent));

router.post(
  "/:id/image",
  authenticate,
  allowRoles("admin"),
  (req, res, next) =>
    uploadEventCoverImage(req, res, (err) => (err ? next(err) : next())),
  asyncHandler(uploadEventCover)
);

router.post(
  "/:id/register",
  authenticate,
  allowRoles("agent"),
  asyncHandler(registerForEvent)
);

router.get(
  "/registrations",
  authenticate,
  allowRoles("admin"),
  asyncHandler(listRegistrations)
);

router.patch(
  "/registrations/:id",
  authenticate,
  allowRoles("admin"),
  asyncHandler(updateRegistrationStatus)
);

router.get(
  "/my",
  authenticate,
  allowRoles("agent"),
  asyncHandler(listMyRegistrations)
);

module.exports = router;
