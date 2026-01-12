export function humanizeApiError(err, fallback = "Ошибка") {
  // Handle Joi validation details
  if (
    err?.response?.data?.details &&
    Array.isArray(err.response.data.details)
  ) {
    return err.response.data.details
      .map((d) => {
        let msg = d.message.replace(/"/g, "");
        // Basic translation map
        const map = {
          password: "Пароль",
          email: "Email",
          phone: "Телефон",
          "is not allowed to be empty": "не может быть пустым",
          "must be a valid email": "должен быть email-адресом",
          "length must be at least": "минимум символов:",
          "length must be less than or equal to": "максимум символов:",
          "must be a number": "должно быть числом",
        };
        for (const [en, ru] of Object.entries(map)) {
          if (msg.includes(en)) {
            msg = msg.replace(en, ru);
          }
        }
        return msg;
      })
      .join("; ");
  }

  const serverMsg = err?.response?.data?.error;
  if (typeof serverMsg === "string" && serverMsg.trim()) return serverMsg;

  const msg = String(err?.message || "");
  if (msg.includes("Network Error")) {
    return "Ошибка сети. Проверьте подключение и попробуйте снова.";
  }

  const status = err?.response?.status;
  if (status === 401) return "Требуется авторизация.";
  if (status === 403) return "Доступ запрещён.";
  if (status === 404) return "Не найдено.";
  if (status === 429) return "Слишком много запросов, попробуйте позже.";

  return fallback;
}
