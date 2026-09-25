import { useEffect, useRef, useState } from "react";
import api, { formatApiError } from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Trash2, GraduationCap, Save, Landmark } from "lucide-react";
import { setLogo as broadcastLogo } from "@/lib/logo";
import { setCompanyPatch, BANK_OPTIONS } from "@/lib/company";
import { BackupEmailCard, ChangePasswordCard } from "@/components/SecuritySettings";

export default function Settings() {
  const [logo, setLogo] = useState("");
  const [company, setCompany] = useState({
    alamat: "",
    bank_name: "BCA",
    bank_account_number: "",
    bank_account_holder: "",
  });
  const [busy, setBusy] = useState(false);
  const [savingCo, setSavingCo] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    api.get("/settings").then((r) => {
      setLogo(r.data.logo_data_url || "");
      setCompany({
        alamat: r.data.alamat || "",
        bank_name: r.data.bank_name || "BCA",
        bank_account_number: r.data.bank_account_number || "",
        bank_account_holder: r.data.bank_account_holder || "",
      });
    }).catch(() => {});
  }, []);

  const onPick = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) return toast.error("File harus berupa gambar");
    if (f.size > 2 * 1024 * 1024) return toast.error("Ukuran maks 2 MB");
    const reader = new FileReader();
    reader.onload = () => setLogo(String(reader.result));
    reader.readAsDataURL(f);
  };

  const save = async () => {
    if (!logo) return toast.error("Pilih file logo dulu");
    setBusy(true);
    try {
      await api.put("/settings/logo", { logo_data_url: logo });
      broadcastLogo(logo);
      setCompanyPatch({ logo_data_url: logo });
      toast.success("Logo berhasil disimpan");
    } catch (e) { toast.error(formatApiError(e)); }
    setBusy(false);
  };

  const remove = async () => {
    if (!window.confirm("Hapus logo?")) return;
    try {
      await api.delete("/settings/logo");
      setLogo(""); broadcastLogo("");
      setCompanyPatch({ logo_data_url: "" });
      toast.success("Logo dihapus");
    } catch (e) { toast.error(formatApiError(e)); }
  };

  const saveCompany = async () => {
    setSavingCo(true);
    try {
      await api.put("/settings/company", company);
      setCompanyPatch(company);
      toast.success("Pengaturan perusahaan tersimpan");
    } catch (e) { toast.error(formatApiError(e)); }
    setSavingCo(false);
  };

  const selectedBank = BANK_OPTIONS.find(b => b.code === company.bank_name) || BANK_OPTIONS[0];

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Pengaturan</h1>
        <p className="text-sm text-slate-500 mt-1">Kelola logo, alamat, informasi rekening pembayaran, dan keamanan akun.</p>
      </div>

      <div className="flex items-center gap-2 pt-2">
        <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Keamanan Akun</div>
        <div className="flex-1 border-t border-slate-200"/>
      </div>
      <BackupEmailCard/>
      <ChangePasswordCard/>

      <div className="flex items-center gap-2 pt-2">
        <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Perusahaan</div>
        <div className="flex-1 border-t border-slate-200"/>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
        <div>
          <div className="text-sm font-semibold text-slate-900 mb-1">Logo Bimbel AELC</div>
          <div className="text-xs text-slate-500">Format PNG/JPG/SVG, maks 2 MB. Disarankan rasio 1:1.</div>
        </div>

        <div className="flex items-center gap-6">
          <div className="h-28 w-28 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 flex items-center justify-center overflow-hidden">
            {logo ? (
              <img src={logo} alt="Logo" className="h-full w-full object-contain" data-testid="logo-preview"/>
            ) : (
              <div className="flex flex-col items-center text-slate-400">
                <GraduationCap className="h-8 w-8"/>
                <span className="text-[10px] mt-1">Placeholder</span>
              </div>
            )}
          </div>
          <div className="flex-1 space-y-2">
            <input ref={fileRef} type="file" accept="image/*" onChange={onPick} className="hidden" data-testid="logo-input"/>
            <div className="flex gap-2 flex-wrap">
              <Button data-testid="logo-pick-btn" onClick={()=>fileRef.current?.click()} variant="outline">
                <Upload className="h-4 w-4 mr-2"/> Pilih File
              </Button>
              <Button data-testid="logo-save-btn" onClick={save} disabled={busy || !logo} className="bg-blue-600 hover:bg-blue-700 text-white">
                Simpan Logo
              </Button>
              {logo && (
                <Button data-testid="logo-delete-btn" onClick={remove} variant="outline" className="text-rose-600 hover:bg-rose-50 border-rose-200">
                  <Trash2 className="h-4 w-4 mr-2"/> Hapus
                </Button>
              )}
            </div>
            <p className="text-xs text-slate-500">Logo akan otomatis muncul di header invoice PDF.</p>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div>
          <div className="text-sm font-semibold text-slate-900 mb-1">Alamat Perusahaan</div>
          <div className="text-xs text-slate-500">Muncul di header invoice.</div>
        </div>
        <Textarea data-testid="settings-alamat" rows={3} value={company.alamat}
                  onChange={(e)=>setCompany(c=>({...c, alamat: e.target.value}))}
                  placeholder="Jl. Teratai No 19, Rawa Laut, Enggal, Tanjung Karang Timur, Bandar Lampung"/>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Landmark className="h-4 w-4 text-slate-600"/>
          <div className="text-sm font-semibold text-slate-900">Rekening Pembayaran</div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label>Bank</Label>
            <Select value={company.bank_name} onValueChange={(v)=>setCompany(c=>({...c, bank_name: v}))}>
              <SelectTrigger data-testid="settings-bank"><SelectValue/></SelectTrigger>
              <SelectContent>{BANK_OPTIONS.map(b=><SelectItem key={b.code} value={b.code}>{b.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>No Rekening</Label>
            <Input data-testid="settings-norek" value={company.bank_account_number}
                   onChange={(e)=>setCompany(c=>({...c, bank_account_number: e.target.value}))}
                   placeholder="4300961717"/>
          </div>
          <div className="sm:col-span-2">
            <Label>Atas Nama</Label>
            <Input data-testid="settings-holder" value={company.bank_account_holder}
                   onChange={(e)=>setCompany(c=>({...c, bank_account_holder: e.target.value}))}
                   placeholder="CV ARITA YASA NUSANTARA"/>
          </div>
        </div>
        <div className="rounded-lg border p-3 flex items-center gap-3" style={{backgroundColor: selectedBank.bg, borderColor: `${selectedBank.color}33`}}>
          <div className="px-3 py-1.5 rounded font-extrabold text-white text-lg" style={{backgroundColor: selectedBank.color}}>
            {selectedBank.name}
          </div>
          <div className="font-mono text-lg font-bold" style={{color: selectedBank.color}}>
            {company.bank_account_number || "————"}
          </div>
        </div>
        <div className="flex justify-end">
          <Button data-testid="settings-save-company" onClick={saveCompany} disabled={savingCo} className="bg-blue-600 hover:bg-blue-700 text-white">
            <Save className="h-4 w-4 mr-2"/> Simpan Perusahaan
          </Button>
        </div>
      </div>
    </div>
  );
}
