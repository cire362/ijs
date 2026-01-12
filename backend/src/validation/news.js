const Joi = require("joi");

const createNewsSchema = Joi.object({
  title: Joi.string().trim().max(200).required().messages({
    "any.required": "Укажите заголовок",
  }),
  subtitle: Joi.string().trim().max(200).allow(null, ""),
  excerpt: Joi.string().max(2000).allow(null, ""),
  content: Joi.string().trim().min(1).max(50000).required().messages({
    "any.required": "Текст новости обязателен",
    "string.empty": "Текст новости не может быть пустым",
    "string.min": "Текст новости не может быть пустым",
  }),
  isPublished: Joi.boolean(),
});

const updateNewsSchema = Joi.object({
  title: Joi.string().trim().max(200),
  subtitle: Joi.string().trim().max(200).allow(null, ""),
  excerpt: Joi.string().max(2000).allow(null, ""),
  content: Joi.string().trim().min(1).max(50000),
  isPublished: Joi.boolean(),
});

module.exports = {
  createNewsSchema,
  updateNewsSchema,
};
