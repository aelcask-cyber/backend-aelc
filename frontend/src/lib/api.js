import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

const api = axios.create({
  baseURL: API,
  withCredentials: true,
});

// Autentikasi memakai cookie httpOnly (access_token) — token tidak disimpan di localStorage.
api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err?.response?.status === 401 && !err.config?.url?.includes("/auth/login") && window.location.pathname !== "/login") {
      window.location.replace("/login");
    }
    return Promise.reject(err);
  }
);

export function formatApiError(err) {
  const d = err?.response?.data?.detail;
  if (!d) return err?.message || "Terjadi kesalahan.";
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return d.map((e) => e?.msg || JSON.stringify(e)).join(" ");
  return String(d);
}

export default api;
