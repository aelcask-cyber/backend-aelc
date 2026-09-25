import { useEffect, useState } from "react";
import api, { formatApiError } from "@/lib/api";
import { fmtIDR, fmtDate, PROGRAM_KELAS, PROGRAM_BIMBEL } from "@/lib/format";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, Search, Download } from "lucide-react";

const empty = {
  nama: "", tanggal_lahir: "", kelas: "", asal_sekolah: "",
  program_kelas: "Junior Regular", program_bimbel: "Bimbel Global",
  biaya: 0, no_hp: "",
};

export default function Students() {
  const [list, setList] = useState([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);

  const load = async () => {
    try { const { data } = await api.get("/students"); setList(data); }
    catch (e) { toast.error(formatApiError(e)); }
  };
  useEffect(() => { load(); }, []);

  const openAdd = () => { setEditing(null); setForm(empty); setOpen(true); };
  const openEdit = (s) => {
    setEditing(s);
    setForm({
      nama: s.nama, tanggal_lahir: s.tanggal_lahir?.slice(0,10) || "",
      kelas: s.kelas, asal_sekolah: s.asal_sekolah,
      program_kelas: s.program_kelas, program_bimbel: s.program_bimbel,
      biaya: s.biaya, no_hp: s.no_hp,
    });
    setOpen(true);
  };

  const save = async () => {
    try {
      const payload = { ...form, biaya: Number(form.biaya) };
      if (editing) {
        await api.put(`/students/${editing.id}`, payload);
        toast.success("Siswa berhasil diperbarui");
      } else {
        await api.post("/students", payload);
        toast.success("Siswa berhasil ditambahkan");
      }
      setOpen(false); load();
    } catch (e) { toast.error(formatApiError(e)); }
  };

  const remove = async (s) => {
    if (!window.confirm(`Hapus siswa ${s.nama}?`)) return;
    try { await api.delete(`/students/${s.id}`); toast.success("Siswa dihapus"); load(); }
    catch (e) { toast.error(formatApiError(e)); }
  };

  const exportExcel = () => {
    if (list.length === 0) return toast.error("Belum ada data siswa untuk diekspor");
    const rows = list.map(s => ({
      "No Urut": s.no_urut,
      "Nama": s.nama,
      "Tanggal Lahir": s.tanggal_lahir,
      "Kelas": s.kelas,
      "Asal Sekolah": s.asal_sekolah,
      "Program Kelas": s.program_kelas,
      "Program Bimbel": s.program_bimbel,
      "Biaya": s.biaya,
      "No HP / WhatsApp": s.no_hp,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [{wch:6},{wch:24},{wch:14},{wch:10},{wch:24},{wch:22},{wch:24},{wch:14},{wch:18}];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Siswa");
    const today = new Date().toISOString().slice(0,10);
    XLSX.writeFile(wb, `Bimbel-AELC-Siswa-${today}.xlsx`);
    toast.success("Excel berhasil diunduh");
  };

  const filtered = list.filter((s) => {
    if (!q) return true;
    const t = q.toLowerCase();
    return s.nama.toLowerCase().includes(t) || (s.kelas || "").toLowerCase().includes(t);
  });

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Data Keseluruhan Siswa</h1>
          <p className="text-sm text-slate-500 mt-1">Master data induk siswa Bimbel AELC.</p>
        </div>
        <div className="flex gap-2">
          <Button data-testid="export-excel-btn" onClick={exportExcel} variant="outline" className="border-emerald-500 text-emerald-700 hover:bg-emerald-50">
            <Download className="h-4 w-4 mr-2" /> Export Excel
          </Button>
          <Button data-testid="add-student-btn" onClick={openAdd} className="bg-blue-600 hover:bg-blue-700 text-white">
            <Plus className="h-4 w-4 mr-2" /> Tambah Siswa
          </Button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl">
        <div className="p-4 flex flex-wrap gap-3 items-center border-b border-slate-200">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input data-testid="students-search" placeholder="Cari nama atau kelas..." value={q} onChange={(e)=>setQ(e.target.value)} className="pl-9" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="text-left px-4 py-3 font-semibold">No</th>
                <th className="text-left px-4 py-3 font-semibold">Nama</th>
                <th className="text-left px-4 py-3 font-semibold">Tgl Lahir</th>
                <th className="text-left px-4 py-3 font-semibold">Kelas</th>
                <th className="text-left px-4 py-3 font-semibold">Sekolah</th>
                <th className="text-left px-4 py-3 font-semibold">Program Kelas</th>
                <th className="text-left px-4 py-3 font-semibold">Program Bimbel</th>
                <th className="text-right px-4 py-3 font-semibold">Biaya</th>
                <th className="text-left px-4 py-3 font-semibold">No HP</th>
                <th className="text-right px-4 py-3 font-semibold">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={10} className="px-4 py-10 text-center text-slate-400">Belum ada data siswa.</td></tr>
              )}
              {filtered.map((s) => (
                <tr key={s.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 font-semibold text-slate-900">{s.no_urut}</td>
                  <td className="px-4 py-3 text-slate-900">{s.nama}</td>
                  <td className="px-4 py-3 text-slate-600">{fmtDate(s.tanggal_lahir)}</td>
                  <td className="px-4 py-3 text-slate-600">{s.kelas}</td>
                  <td className="px-4 py-3 text-slate-600">{s.asal_sekolah}</td>
                  <td className="px-4 py-3 text-slate-600">{s.program_kelas}</td>
                  <td className="px-4 py-3 text-slate-600">{s.program_bimbel}</td>
                  <td className="px-4 py-3 text-right font-mono text-slate-900">{fmtIDR(s.biaya)}</td>
                  <td className="px-4 py-3 text-slate-600">{s.no_hp}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Button data-testid={`edit-student-${s.no_urut}`} size="icon" variant="ghost" onClick={()=>openEdit(s)}>
                        <Pencil className="h-4 w-4"/>
                      </Button>
                      <Button data-testid={`delete-student-${s.no_urut}`} size="icon" variant="ghost" onClick={()=>remove(s)} className="text-rose-600 hover:text-rose-700 hover:bg-rose-50">
                        <Trash2 className="h-4 w-4"/>
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl bg-white">
          <DialogHeader><DialogTitle>{editing ? "Edit Siswa" : "Tambah Siswa"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Label>Nama</Label>
              <Input data-testid="form-nama" value={form.nama} onChange={(e)=>setForm({...form, nama: e.target.value})}/>
            </div>
            <div>
              <Label>Tanggal Lahir</Label>
              <Input data-testid="form-tgl-lahir" type="date" value={form.tanggal_lahir} onChange={(e)=>setForm({...form, tanggal_lahir: e.target.value})}/>
            </div>
            <div>
              <Label>Kelas</Label>
              <Input data-testid="form-kelas" placeholder="cth: SD 5" value={form.kelas} onChange={(e)=>setForm({...form, kelas: e.target.value})}/>
            </div>
            <div className="sm:col-span-2">
              <Label>Asal Sekolah</Label>
              <Input data-testid="form-sekolah" value={form.asal_sekolah} onChange={(e)=>setForm({...form, asal_sekolah: e.target.value})}/>
            </div>
            <div>
              <Label>Program Kelas</Label>
              <Select value={form.program_kelas} onValueChange={(v)=>setForm({...form, program_kelas: v})}>
                <SelectTrigger data-testid="form-program-kelas"><SelectValue/></SelectTrigger>
                <SelectContent>{PROGRAM_KELAS.map(p=><SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Program Bimbel</Label>
              <Select value={form.program_bimbel} onValueChange={(v)=>setForm({...form, program_bimbel: v})}>
                <SelectTrigger data-testid="form-program-bimbel"><SelectValue/></SelectTrigger>
                <SelectContent>{PROGRAM_BIMBEL.map(p=><SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Biaya (Rp)</Label>
              <Input data-testid="form-biaya" type="number" value={form.biaya} onChange={(e)=>setForm({...form, biaya: e.target.value})}/>
            </div>
            <div>
              <Label>No HP / WhatsApp</Label>
              <Input data-testid="form-nohp" placeholder="628123..." value={form.no_hp} onChange={(e)=>setForm({...form, no_hp: e.target.value})}/>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={()=>setOpen(false)} data-testid="form-cancel">Batal</Button>
            <Button onClick={save} data-testid="form-save" className="bg-blue-600 hover:bg-blue-700 text-white">Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
