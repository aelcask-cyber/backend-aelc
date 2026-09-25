import { useState } from "react";
import api, { formatApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldCheck, Mail, KeyRound, Send, Loader2 } from "lucide-react";

const PW_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

export function BackupEmailCard() {
  const { user, refreshUser } = useAuth();
  const [email, setEmail] = useState(user?.backup_email || "");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!email.trim()) return toast.error("Email cadangan wajib diisi");
    if (!pw) return toast.error("Masukkan password saat ini untuk konfirmasi");
    setBusy(true);
    try {
      await api.put("/auth/backup-email", { backup_email: email.trim(), current_password: pw });
      await refreshUser();
      setPw("");
      toast.success("Email cadangan tersimpan");
    } catch (e) { toast.error(formatApiError(e)); }
    setBusy(false);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4" data-testid="backup-email-card">
      <div className="flex items-center gap-2">
        <Mail className="h-4 w-4 text-slate-600"/>
        <div className="text-sm font-semibold text-slate-900">Email Cadangan (Verifikasi Keamanan)</div>
      </div>
      <p className="text-xs text-slate-500">Kode OTP untuk mengganti password akan dikirim ke email ini. Status:{" "}
        {user?.backup_email
          ? <span className="font-semibold text-emerald-700" data-testid="backup-email-current">{user.backup_email}</span>
          : <span className="font-semibold text-amber-700" data-testid="backup-email-current">belum diatur</span>}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label>Email Cadangan</Label>
          <Input data-testid="backup-email-input" type="email" value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="cadangan@gmail.com"/>
        </div>
        <div>
          <Label>Password Saat Ini</Label>
          <Input data-testid="backup-email-password" type="password" value={pw} onChange={(e)=>setPw(e.target.value)} autoComplete="current-password"/>
        </div>
      </div>
      <div className="flex justify-end">
        <Button data-testid="backup-email-save" onClick={save} disabled={busy} className="bg-blue-600 hover:bg-blue-700 text-white">
          {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin"/> : <Mail className="h-4 w-4 mr-2"/>} Simpan Email Cadangan
        </Button>
      </div>
    </div>
  );
}

export function ChangePasswordCard() {
  const { user } = useAuth();
  const [f, setF] = useState({ current: "", next: "", confirm: "", otp: "" });
  const [sentTo, setSentTo] = useState("");
  const [sending, setSending] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF(s => ({ ...s, [k]: e.target.value }));

  const requestOtp = async () => {
    setSending(true);
    try {
      const { data } = await api.post("/auth/change-password/request-otp");
      setSentTo(data.sent_to);
      toast.success(`Kode OTP dikirim ke ${data.sent_to}`);
    } catch (e) { toast.error(formatApiError(e)); }
    setSending(false);
  };

  const submit = async () => {
    if (!f.current || !f.next || !f.otp) return toast.error("Lengkapi semua kolom");
    if (!PW_RULE.test(f.next)) return toast.error("Password baru minimal 8 karakter, wajib ada huruf besar, huruf kecil, dan angka");
    if (f.next !== f.confirm) return toast.error("Konfirmasi password tidak sama");
    setBusy(true);
    try {
      const { data } = await api.post("/auth/change-password", { current_password: f.current, new_password: f.next, otp: f.otp });
      if (data.token) localStorage.setItem("aelc_token", data.token);
      setF({ current: "", next: "", confirm: "", otp: "" }); setSentTo("");
      toast.success("Password berhasil diubah. Sesi perangkat lain otomatis keluar.");
    } catch (e) { toast.error(formatApiError(e)); }
    setBusy(false);
  };

  const strong = PW_RULE.test(f.next);

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4" data-testid="change-password-card">
      <div className="flex items-center gap-2">
        <KeyRound className="h-4 w-4 text-slate-600"/>
        <div className="text-sm font-semibold text-slate-900">Ganti Password</div>
      </div>
      <p className="text-xs text-slate-500">Disarankan mengganti password secara berkala. Wajib verifikasi kode OTP dari email cadangan.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <Label>Password Saat Ini</Label>
          <Input data-testid="cp-current" type="password" value={f.current} onChange={set("current")} autoComplete="current-password"/>
        </div>
        <div>
          <Label>Password Baru</Label>
          <Input data-testid="cp-new" type="password" value={f.next} onChange={set("next")} autoComplete="new-password"/>
          {f.next && (
            <p data-testid="cp-strength" className={`text-[11px] mt-1 ${strong ? "text-emerald-600" : "text-amber-600"}`}>
              {strong ? "Password kuat" : "Min. 8 karakter, huruf besar, huruf kecil & angka"}
            </p>
          )}
        </div>
        <div>
          <Label>Konfirmasi Password Baru</Label>
          <Input data-testid="cp-confirm" type="password" value={f.confirm} onChange={set("confirm")} autoComplete="new-password"/>
        </div>
        <div className="sm:col-span-2">
          <Label>Kode OTP</Label>
          <div className="flex gap-2">
            <Input data-testid="cp-otp" value={f.otp} onChange={set("otp")} placeholder="6 digit" maxLength={6} className="font-mono tracking-widest w-40"/>
            <Button data-testid="cp-request-otp" type="button" variant="outline" onClick={requestOtp} disabled={sending || !user?.backup_email}
                    className="border-blue-500 text-blue-700 hover:bg-blue-50">
              {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin"/> : <Send className="h-4 w-4 mr-2"/>} Kirim OTP
            </Button>
          </div>
          <p className="text-[11px] text-slate-500 mt-1" data-testid="cp-otp-hint">
            {!user?.backup_email ? "Atur email cadangan terlebih dahulu untuk menerima OTP." : sentTo ? `Kode dikirim ke ${sentTo} (berlaku 10 menit).` : "Klik Kirim OTP untuk menerima kode di email cadangan."}
          </p>
        </div>
      </div>
      <div className="flex justify-end">
        <Button data-testid="cp-submit" onClick={submit} disabled={busy} className="bg-blue-600 hover:bg-blue-700 text-white">
          {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin"/> : <ShieldCheck className="h-4 w-4 mr-2"/>} Ubah Password
        </Button>
      </div>
    </div>
  );
}
