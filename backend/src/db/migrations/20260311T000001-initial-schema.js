const models = require("../../models");

const orderedModels = [
  models.User,
  models.Property,
  models.Application,
  models.Notification,
  models.PropertyImage,
  models.PropertyDocument,
  models.StatusHistory,
  models.News,
  models.NewsImage,
  models.Event,
  models.EventRegistration,
  models.AddressSuggestion,
  models.AuthSession,
  models.SupportRequest,
  models.ChatMessage,
  models.SupportChat,
  models.ApplicationChatMessage,
  models.TariffCounterparty,
  models.TariffComplex,
  models.TariffRate,
  models.TariffPropertyRate,
];

const orderedTableNames = orderedModels.map((model) => model.getTableName());

async function syncModel(model) {
  await model.sync();
}

async function dropTable(queryInterface, tableName, transaction) {
  try {
    await queryInterface.dropTable(tableName, { transaction });
  } catch (error) {
    const message = String(error?.message || "");
    if (!message.includes("does not exist")) {
      throw error;
    }
  }
}

async function dropEnum(queryInterface, enumName, transaction) {
  await queryInterface.sequelize.query(`DROP TYPE IF EXISTS "${enumName}";`, {
    transaction,
  });
}

module.exports = {
  useTransaction: false,

  async up() {
    for (const model of orderedModels) {
      await syncModel(model);
    }
  },

  async down({ queryInterface, transaction }) {
    for (const tableName of [...orderedTableNames].reverse()) {
      await dropTable(queryInterface, tableName, transaction);
    }

    await dropEnum(queryInterface, "enum_users_role", transaction);
    await dropEnum(queryInterface, "enum_properties_sale_status", transaction);
    await dropEnum(queryInterface, "enum_applications_status", transaction);
    await dropEnum(queryInterface, "enum_events_format", transaction);
    await dropEnum(
      queryInterface,
      "enum_event_registrations_status",
      transaction,
    );
    await dropEnum(
      queryInterface,
      "enum_address_suggestions_kind",
      transaction,
    );
    await dropEnum(queryInterface, "enum_support_requests_status", transaction);
    await dropEnum(
      queryInterface,
      "enum_tariff_counterparties_type",
      transaction,
    );
    await dropEnum(queryInterface, "enum_tariff_rates_category", transaction);
    await dropEnum(
      queryInterface,
      "enum_tariff_property_rates_category",
      transaction,
    );
  },
};
