export function humanizeApiError(err, fallback = "Ошибка") {
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
