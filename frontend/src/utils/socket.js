import { io } from "socket.io-client";

function resolveSocketUrl() {
  const raw = import.meta.env.VITE_API_URL;

  // Если API задано относительным путём (например "/api"), то для socket.io
  // нужен origin (http(s)://domain), а не путь.
  if (raw && typeof raw === "string" && raw.startsWith("/")) {
    return window.location.origin;
  }

  // Если API задан абсолютным URL (https://api.example.com) — используем его.
  if (raw) return raw;

  // По умолчанию:
  // - в production подключаемся к текущему домену (Nginx проксирует /socket.io)
  // - в dev оставляем localhost:4000
  if (import.meta.env.PROD) {
    return window.location.origin;
  }

  return "http://localhost:4000";
}

const socketUrl = resolveSocketUrl();
let socket;

export function getSocket() {
  if (!socket) {
    socket = io(socketUrl, { autoConnect: true });
  }
  return socket;
}
