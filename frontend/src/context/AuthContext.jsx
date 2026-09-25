import { createContext, useContext, useEffect, useState } from "react";
import api, { formatApiError } from "@/lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // null=checking, false=guest, obj=user
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/auth/me")
      .then((r) => setUser(r.data))
      .catch(() => {
        localStorage.removeItem("aelc_token");
        setUser(false);
      });
  }, []);

  const login = async (email, password) => {
    setError("");
    try {
      const { data } = await api.post("/auth/login", { email, password });
      localStorage.setItem("aelc_token", data.token);
      setUser(data.user);
      return true;
    } catch (e) {
      setError(formatApiError(e));
      return false;
    }
  };

  const refreshUser = async () => {
    try { const { data } = await api.get("/auth/me"); setUser(data); } catch {}
  };

  const logout = async () => {
    try { await api.post("/auth/logout"); } catch {}
    localStorage.removeItem("aelc_token");
    setUser(false);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, error, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
