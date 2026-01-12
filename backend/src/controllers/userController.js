const userService = require("../services/userService");
const asyncHandler = require("../utils/asyncHandler");

const getMe = asyncHandler(async (req, res) => {
  const user = await userService.getMe(req.user);
  res.json(user);
});

const updateMe = asyncHandler(async (req, res) => {
  const user = await userService.updateMe(req.user, req.body);
  res.json(user);
});

const uploadMyAvatar = asyncHandler(async (req, res) => {
  const user = await userService.uploadMyAvatar(req.user, req.file);
  res.json(user);
});

const changeMyPassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  await userService.changeMyPassword(req.user, currentPassword, newPassword);
  res.json({ success: true });
});

const listDevelopers = asyncHandler(async (req, res) => {
  const users = await userService.listDevelopers(req.query);
  res.json(users);
});

const approveDeveloper = asyncHandler(async (req, res) => {
  const user = await userService.approveDeveloper(req.params.id);
  res.json(user);
});

const rejectDeveloper = asyncHandler(async (req, res) => {
  const user = await userService.rejectDeveloper(req.params.id);
  res.json(user);
});

const deleteDeveloperRequest = asyncHandler(async (req, res) => {
  await userService.deleteDeveloperRequest(req.params.id);
  res.json({ success: true });
});

const createDeveloperByAdmin = asyncHandler(async (req, res) => {
  const user = await userService.createDeveloperByAdmin(req.body);
  res.status(201).json(user);
});

module.exports = {
  getMe,
  updateMe,
  uploadMyAvatar,
  changeMyPassword,
  listDevelopers,
  approveDeveloper,
  rejectDeveloper,
  deleteDeveloperRequest,
  createDeveloperByAdmin,
};
