import { defineStore } from "pinia";
import axios from "axios";

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || "/api" });

function applyAuthHeader(token) {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
}

export const useAuthStore = defineStore("auth", {
  state: () => ({ user: null, token: null, loading: false, error: null }),
  actions: {
    hydrate() {
      const saved = localStorage.getItem("auth");
      if (saved) {
        const parsed = JSON.parse(saved);
        this.user = parsed.user;
        this.token = parsed.token;
        applyAuthHeader(parsed.token);
      }
    },
    persist() {
      localStorage.setItem(
        "auth",
        JSON.stringify({ user: this.user, token: this.token })
      );
    },
    async login(email, password) {
      this.loading = true;
      this.error = null;
      try {
        const { data } = await api.post("/auth/login", { email, password });
        this.user = data.user;
        this.token = data.token;
        applyAuthHeader(data.token);
        this.persist();
      } catch (err) {
        this.error = err.response?.data?.error || "Login failed";
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
        this.error = err.response?.data?.error || "Registration failed";
      } finally {
        this.loading = false;
      }
    },
    logout() {
      this.user = null;
      this.token = null;
      localStorage.removeItem("auth");
      applyAuthHeader(null);
    },
  },
});

export const apiClient = api;
