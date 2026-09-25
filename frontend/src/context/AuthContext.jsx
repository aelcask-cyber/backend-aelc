import { createContext, useContext, useEffect, useMemo, useState } from "react";
import api, { formatApiError } from "@/lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // null=checking, false=guest, obj=user
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/auth/me")
      .then((r) => setUser(r.data))
      .catch(() => setUser(false));
  }, []);

  const value = useMemo(() => ({
    user,
    error,
    login: async (email, password) => {
      setError("");
      try {
        const { data } = await api.post("/auth/login", { email, password });
        setUser(data.user);
        return true;
      } catch (e) {
        setError(formatApiError(e));
        return false;
      }
    },
    refreshUser: async () => {
      try { const { data } = await api.get("/auth/me"); setUser(data); }
      catch (e) { console.warn("Gagal memuat profil:", formatApiError(e)); }
    },
    logout: async () => {
      try { await api.post("/auth/logout"); }
      catch (e) { console.warn("Logout server gagal, sesi lokal dihapus:", formatApiError(e)); }
      setUser(false);
    },
  }), [user, error]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
