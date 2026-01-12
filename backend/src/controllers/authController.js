const authService = require("../services/authService");
const asyncHandler = require("../utils/asyncHandler");

const register = asyncHandler(async (req, res) => {
  const result = await authService.register(req.body);
  res.status(201).json(result);
});

const login = asyncHandler(async (req, res) => {
  const result = await authService.login(req.body.email, req.body.password, {
    req,
    res,
  });
  res.json(result);
});

const refresh = asyncHandler(async (req, res) => {
  const result = await authService.refresh(req.cookies, { req, res });
  res.json(result);
});

const logout = asyncHandler(async (req, res) => {
  await authService.logout(req.cookies, res);
  res.json({ success: true });
});

const logoutAll = asyncHandler(async (req, res) => {
  await authService.logoutAll(req.cookies, res);
  res.json({ success: true });
});

module.exports = {
  register,
  login,
  refresh,
  logout,
  logoutAll,
};
