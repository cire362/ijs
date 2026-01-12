const Joi = require("joi");

const validate = (schema, property = "body") => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      stripUnknown: true, // remove fields that are not in the schema
    });

    if (error) {
      const details = error.details.map((detail) => ({
        message: detail.message,
        path: detail.path,
      }));
      console.log("Validation Error:", JSON.stringify(details, null, 2));
      return res.status(400).json({ error: "Ошибка валидации", details });
    }

    req[property] = value;
    next();
  };
};

module.exports = validate;
