const applicationChatService = require("../services/applicationChatService");
const asyncHandler = require("../utils/asyncHandler");
const { getIO } = require("../socket");

const listChats = asyncHandler(async (req, res) => {
  const chats = await applicationChatService.listChats(req.user);
  res.json(chats);
});

const listMessages = asyncHandler(async (req, res) => {
  const messages = await applicationChatService.listMessages(
    req.params.id,
    req.user,
  );
  res.json(messages);
});

const createMessage = asyncHandler(async (req, res) => {
  const message = await applicationChatService.createMessage(
    req.params.id,
    { text: req.body?.text },
    req.file,
    req.user,
  );

  const io = getIO();
  if (io) {
    const applicationId = Number(req.params.id);
    io.to(`application:${applicationId}`).emit("application_chat_message", {
      applicationId,
      message,
    });

    io.to("application_admins").emit("application_chat_message", {
      applicationId,
      message,
    });
  }
  res.status(201).json(message);
});

module.exports = { listChats, listMessages, createMessage };
