import { defineStore } from "pinia";
import axios from "axios";
import { humanizeApiError } from "@/utils/errors";
import { getSocket } from "@/utils/socket";

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || "/api" });

function getCookie(name) {
  const parts = String(document.cookie || "")
    .split(";")
    .map((p) => p.trim());
  for (const part of parts) {
    if (!part) continue;
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const k = decodeURIComponent(part.slice(0, eq));
    if (k !== name) continue;
    return decodeURIComponent(part.slice(eq + 1));
  }
  return null;
}

function csrfHeaders() {
  const csrf = getCookie("csrf_token");
  return csrf ? { "x-csrf-token": csrf } : {};
}

function applyAuthHeader(token) {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
}

function clearLocalStorageOnLogout() {
  // Keep non-auth UX prefs (e.g. cookie consent). Remove keys that can leak user context.
  try {
    localStorage.removeItem("chat_guest_room");
  } catch {
    // Ignore (private mode / disabled storage)
  }
}

function resetSocketConnectionOnLogout() {
  try {
    const socket = getSocket();
    // Reconnect to drop any server-side room memberships from the previous session.
    socket.disconnect();
    socket.connect();
  } catch {
    // Ignore
  }
}

export const useAuthStore = defineStore("auth", {
  state: () => ({ user: null, token: null, loading: false, error: null }),
  actions: {
    async bootstrap() {
      // Try to restore session via refresh-cookie (no localStorage).
      try {
        const { data } = await api.post("/auth/refresh", null, {
          headers: csrfHeaders(),
        });
        this.user = data.user;
        this.token = data.token;
        applyAuthHeader(data.token);
      } catch {
        // Not logged in / no cookie / csrf missing — that's fine.
        this.user = null;
        this.token = null;
        applyAuthHeader(null);
      }
    },
    async login(email, password) {
      this.loading = true;
      this.error = null;
      try {
        const { data } = await api.post("/auth/login", { email, password });
        this.user = data.user;
        this.token = data.token;
        applyAuthHeader(data.token);
      } catch (err) {
        this.error = humanizeApiError(err, "Не удалось войти");
      } finally {
        this.loading = false;
      }
    },
    async register(payload) {
      this.loading = true;
      this.error = null;
      try {
        await api.post("/auth/register", payload);
        await this.login(payload.email, payload.password);
      } catch (err) {
        this.error = humanizeApiError(err, "Не удалось зарегистрироваться");
      } finally {
        this.loading = false;
      }
    },
    async refresh() {
      const { data } = await api.post("/auth/refresh", null, {
        headers: csrfHeaders(),
      });
      this.user = data.user;
      this.token = data.token;
      applyAuthHeader(data.token);
      return data.token;
    },
    clearLocalState() {
      this.user = null;
      this.token = null;
      applyAuthHeader(null);
    },
    async logout() {
      try {
        await api.post("/auth/logout", null, { headers: csrfHeaders() });
      } finally {
        clearLocalStorageOnLogout();
        resetSocketConnectionOnLogout();
        this.clearLocalState();
      }
    },
  },
});

export const apiClient = api;

// 401 auto-refresh retry (single flight)
let refreshPromise = null;

api.interceptors.response.use(
  (resp) => resp,
  async (error) => {
    const original = error?.config;
    const status = error?.response?.status;

    if (!original || status !== 401 || original.__retry) {
      return Promise.reject(error);
    }

    original.__retry = true;
    const auth = useAuthStore();

    try {
      refreshPromise = refreshPromise || auth.refresh();
      await refreshPromise;
      refreshPromise = null;
      return api.request(original);
    } catch (e) {
      refreshPromise = null;
      auth.clearLocalState();
      return Promise.reject(error);
    }
  },
);
