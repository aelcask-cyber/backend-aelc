import axios from "axios";

// Di Emergent: REACT_APP_BACKEND_URL dari .env. Di Vercel (frontend + /api satu domain): fallback ke origin saat ini.
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || window.location.origin;
export const API = `${BACKEND_URL}/api`;

const api = axios.create({
  baseURL: API,
  withCredentials: true,
});

// Autentikasi utama memakai cookie httpOnly (access_token). Token juga dipegang di memori (tidak persisten)
// sebagai cadangan Authorization header bila browser memblokir cookie lintas-domain.
let memoryToken = null;
export const setAuthToken = (t) => { memoryToken = t || null; };

api.interceptors.request.use((cfg) => {
  if (memoryToken) cfg.headers.Authorization = `Bearer ${memoryToken}`;
  return cfg;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err?.response?.status === 401 && !err.config?.url?.includes("/auth/login") && window.location.pathname !== "/login") {
      memoryToken = null;
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
