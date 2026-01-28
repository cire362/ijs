const User = require("./user");
const Property = require("./property");
const Application = require("./application");
const Notification = require("./notification");
const PropertyImage = require("./propertyImage");
const StatusHistory = require("./statusHistory");
const News = require("./news");
const NewsImage = require("./newsImage");
const Event = require("./event");
const EventRegistration = require("./eventRegistration");
const AddressSuggestion = require("./addressSuggestion");
const AuthSession = require("./authSession");
const SupportRequest = require("./supportRequest");
const ChatMessage = require("./chatMessage");
const SupportChat = require("./supportChat");
const PropertyDocument = require("./propertyDocument");
const ApplicationChatMessage = require("./applicationChatMessage");

User.hasMany(Property, { foreignKey: "developerId", as: "properties" });
Property.belongsTo(User, { foreignKey: "developerId", as: "developer" });

Property.hasMany(PropertyImage, { foreignKey: "propertyId", as: "images" });
PropertyImage.belongsTo(Property, { foreignKey: "propertyId" });

Property.hasMany(PropertyDocument, {
  foreignKey: "propertyId",
  as: "documents",
});
PropertyDocument.belongsTo(Property, { foreignKey: "propertyId" });

Property.hasMany(Application, { foreignKey: "propertyId", as: "applications" });
Application.belongsTo(Property, { foreignKey: "propertyId" });

User.hasMany(Application, { foreignKey: "agentId", as: "agentApplications" });
Application.belongsTo(User, { foreignKey: "agentId", as: "agent" });

Application.hasMany(StatusHistory, {
  foreignKey: "applicationId",
  as: "history",
});
StatusHistory.belongsTo(Application, { foreignKey: "applicationId" });
StatusHistory.belongsTo(User, { foreignKey: "changedBy", as: "actor" });

Application.hasMany(ApplicationChatMessage, {
  foreignKey: "applicationId",
  as: "chatMessages",
});
ApplicationChatMessage.belongsTo(Application, { foreignKey: "applicationId" });
User.hasMany(ApplicationChatMessage, {
  foreignKey: "senderId",
  as: "applicationChatMessages",
});
ApplicationChatMessage.belongsTo(User, {
  foreignKey: "senderId",
  as: "sender",
});

User.hasMany(Notification, { foreignKey: "userId", as: "notifications" });
Notification.belongsTo(User, { foreignKey: "userId" });

User.hasMany(News, { foreignKey: "authorId", as: "news" });
News.belongsTo(User, { foreignKey: "authorId", as: "author" });

News.hasMany(NewsImage, { foreignKey: "newsId", as: "images" });
NewsImage.belongsTo(News, { foreignKey: "newsId" });

User.hasMany(Event, { foreignKey: "createdBy", as: "createdEvents" });
Event.belongsTo(User, { foreignKey: "createdBy", as: "creator" });

Event.hasMany(EventRegistration, {
  foreignKey: "eventId",
  as: "registrations",
});
EventRegistration.belongsTo(Event, { foreignKey: "eventId", as: "event" });

User.hasMany(EventRegistration, {
  foreignKey: "agentId",
  as: "eventRegistrations",
});
EventRegistration.belongsTo(User, { foreignKey: "agentId", as: "agent" });

User.hasMany(AuthSession, { foreignKey: "userId" });
AuthSession.belongsTo(User, { foreignKey: "userId" });

module.exports = {
  User,
  Property,
  Application,
  Notification,
  PropertyImage,
  StatusHistory,
  News,
  NewsImage,
  Event,
  EventRegistration,
  AddressSuggestion,
  AuthSession,
  SupportRequest,
  ChatMessage,
  SupportChat,
  PropertyDocument,
  ApplicationChatMessage,
};
