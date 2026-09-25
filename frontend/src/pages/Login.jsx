import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GraduationCap, Loader2, Eye, EyeOff } from "lucide-react";

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
const GOOGLE_ICON = "https://www.google.com/favicon.ico";

export default function Login() {
  const { user, login, error } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);

  const loginWithGoogle = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + "/";
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  if (user) return <Navigate to="/" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    await login(email, password);
    setBusy(false);
  };

  return (
    <div className="min-h-screen flex items-stretch bg-slate-50">
      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-blue-700 via-blue-800 to-slate-900 relative overflow-hidden">
        <div className="absolute inset-0 opacity-20"
             style={{backgroundImage: "radial-gradient(circle at 20% 30%, white 1px, transparent 1px)", backgroundSize: "40px 40px"}} />
        <div className="relative z-10 flex flex-col justify-between p-12 text-white">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center">
              <GraduationCap className="h-6 w-6" />
            </div>
            <div>
              <div className="text-xl font-extrabold tracking-tight">Bimbel AELC</div>
              <div className="text-xs text-blue-200">CV Arita Yasa Nusantara</div>
            </div>
          </div>
          <div className="space-y-4 max-w-md">
            <h1 className="text-4xl font-extrabold leading-tight">Sistem Operasional Administrasi Bimbel</h1>
            <p className="text-blue-100 text-base">Kelola siswa, guru, jadwal, dan invoice dengan satu dashboard yang rapi dan cepat.</p>
          </div>
          <div className="text-sm text-blue-200">© {new Date().getFullYear()} Bimbel AELC</div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 sm:p-10">
        <form onSubmit={submit} className="w-full max-w-md space-y-6 bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
          <div className="lg:hidden flex items-center gap-2 mb-2">
            <div className="h-9 w-9 rounded-lg bg-blue-600 flex items-center justify-center">
              <GraduationCap className="h-5 w-5 text-white" />
            </div>
            <span className="font-extrabold text-lg text-slate-900">Bimbel AELC</span>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Masuk Admin</h2>
            <p className="text-sm text-slate-500 mt-1">Silakan masuk untuk mengelola operasional bimbel.</p>
          </div>

          <div className="space-y-4">
            <div>
              <Label htmlFor="email" className="text-slate-700">Email</Label>
              <Input id="email" data-testid="login-email-input" type="email" value={email}
                     onChange={(e) => setEmail(e.target.value)} placeholder="admin@aelc.co.id"
                     required className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="password" className="text-slate-700">Password</Label>
              <div className="relative mt-1.5">
                <Input id="password" data-testid="login-password-input" type={showPw ? "text" : "password"} value={password}
                       onChange={(e) => setPassword(e.target.value)} required className="pr-10" />
                <button type="button" data-testid="toggle-password-visibility" onClick={() => setShowPw(v => !v)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                        aria-label={showPw ? "Sembunyikan password" : "Tampilkan password"}
                        style={{transitionProperty: "color", transitionDuration: "150ms"}}>
                  {showPw ? <EyeOff className="h-4 w-4"/> : <Eye className="h-4 w-4"/>}
                </button>
              </div>
            </div>
          </div>

          {error && <div data-testid="login-error" className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{error}</div>}

          <Button data-testid="login-submit-btn" type="submit" disabled={busy}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white h-11 font-semibold">
            {busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Memproses...</> : "Masuk"}
          </Button>

          <div className="relative py-2">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200"/></div>
            <div className="relative flex justify-center"><span className="bg-white px-3 text-xs uppercase tracking-widest text-slate-400 font-semibold">atau</span></div>
          </div>

          <Button data-testid="google-login-btn" type="button" onClick={loginWithGoogle} variant="outline"
                  className="w-full h-11 font-semibold border-slate-300 hover:bg-slate-50 text-slate-700">
            <img src={GOOGLE_ICON} alt="" className="h-4 w-4 mr-2"/>
            Masuk dengan Google
          </Button>

          <p className="text-xs text-slate-400 text-center">Hubungi administrator untuk akses akun baru.</p>
        </form>
      </div>
    </div>
  );
}
