import { io } from "socket.io-client";

const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:4000";
let socket;

export function getSocket() {
  if (!socket) {
    socket = io(apiUrl, { autoConnect: true });
  }
  return socket;
}
