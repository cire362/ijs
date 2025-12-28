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

  // Dev fallback
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
