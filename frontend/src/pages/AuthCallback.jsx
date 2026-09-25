import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import api, { formatApiError } from "@/lib/api";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function AuthCallback() {
  const location = useLocation();
  const navigate = useNavigate();
  const { finalizeGoogle } = useAuth();
  const hasProcessed = useRef(false);

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const hash = location.hash || "";
    const match = hash.match(/session_id=([^&]+)/);
    if (!match) {
      navigate("/login", { replace: true });
      return;
    }
    const sessionId = decodeURIComponent(match[1]);
    // Clear the fragment from URL so it's not preserved
    if (window.history.replaceState) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    api.post("/auth/session", null, { headers: { "X-Session-ID": sessionId } })
      .then((r) => {
        finalizeGoogle(r.data.user);
        toast.success(`Selamat datang, ${r.data.user.name || r.data.user.email}!`);
        navigate("/", { replace: true });
      })
      .catch((e) => {
        toast.error(formatApiError(e) || "Login Google gagal");
        navigate("/login", { replace: true });
      });
  }, [location, navigate, finalizeGoogle]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-3">
      <Loader2 className="h-8 w-8 animate-spin text-blue-600"/>
      <p className="text-sm text-slate-600">Memproses login Google…</p>
    </div>
  );
}
