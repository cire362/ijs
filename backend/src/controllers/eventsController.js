const eventsService = require("../services/eventsService");
const asyncHandler = require("../utils/asyncHandler");

const listEvents = asyncHandler(async (req, res) => {
  const result = await eventsService.listEvents(req.query);
  res.json(result);
});

const createEvent = asyncHandler(async (req, res) => {
  const event = await eventsService.createEvent(req.body, req.user);
  res.status(201).json(event);
});

const uploadEventCover = asyncHandler(async (req, res) => {
  const event = await eventsService.uploadEventCover(req.params.id, req.file);
  res.status(201).json(event);
});

const registerForEvent = asyncHandler(async (req, res) => {
  const registration = await eventsService.registerForEvent(
    req.params.id,
    req.user
  );
  res.status(201).json(registration);
});

const listRegistrations = asyncHandler(async (req, res) => {
  const items = await eventsService.listRegistrations(req.query);
  res.json(items);
});

const listMyRegistrations = asyncHandler(async (req, res) => {
  const result = await eventsService.listMyRegistrations(req.query, req.user);
  res.json(result);
});

const updateRegistrationStatus = asyncHandler(async (req, res) => {
  const updated = await eventsService.updateRegistrationStatus(
    req.params.id,
    req.body
  );
  res.json(updated);
});

module.exports = {
  listEvents,
  createEvent,
  uploadEventCover,
  registerForEvent,
  listRegistrations,
  listMyRegistrations,
  updateRegistrationStatus,
};
