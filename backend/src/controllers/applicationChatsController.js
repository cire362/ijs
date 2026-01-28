const applicationChatService = require("../services/applicationChatService");
const asyncHandler = require("../utils/asyncHandler");

const listChats = asyncHandler(async (req, res) => {
  const chats = await applicationChatService.listChats(req.user);
  res.json(chats);
});

module.exports = { listChats };
