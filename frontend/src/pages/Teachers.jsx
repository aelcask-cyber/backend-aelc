import { useEffect, useState } from "react";
import api, { formatApiError } from "@/lib/api";
import { TIME_SLOTS } from "@/lib/format";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Clock } from "lucide-react";

const empty = { nama: "", mata_pelajaran: "", no_hp: "", available_slots: [] };

export default function Teachers() {
  const [list, setList] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);

  const load = async () => {
    try { const { data } = await api.get("/teachers"); setList(data); }
    catch (e) { toast.error(formatApiError(e)); }
  };
  useEffect(() => { load(); }, []);

  const openAdd = () => { setEditing(null); setForm(empty); setOpen(true); };
  const openEdit = (t) => {
    setEditing(t);
    setForm({
      nama: t.nama,
      mata_pelajaran: t.mata_pelajaran || "",
      no_hp: t.no_hp || "",
      available_slots: Array.isArray(t.available_slots) ? t.available_slots : [],
    });
    setOpen(true);
  };

  const toggleSlot = (slot) => {
    setForm(f => {
      const has = f.available_slots.includes(slot);
      const next = has ? f.available_slots.filter(s => s !== slot) : [...f.available_slots, slot];
      // keep in canonical order
      next.sort((a, b) => TIME_SLOTS.indexOf(a) - TIME_SLOTS.indexOf(b));
      return { ...f, available_slots: next };
    });
  };

  const selectAll = () => setForm(f => ({ ...f, available_slots: [...TIME_SLOTS] }));
  const clearAll = () => setForm(f => ({ ...f, available_slots: [] }));

  const save = async () => {
    if (!form.nama.trim()) return toast.error("Nama guru wajib diisi");
    try {
      if (editing) { await api.put(`/teachers/${editing.id}`, form); toast.success("Guru diperbarui"); }
      else { await api.post("/teachers", form); toast.success("Guru ditambahkan"); }
      setOpen(false); load();
    } catch (e) { toast.error(formatApiError(e)); }
  };

  const remove = async (t) => {
    if (!window.confirm(`Hapus guru ${t.nama}?`)) return;
    try { await api.delete(`/teachers/${t.id}`); toast.success("Guru dihapus"); load(); }
    catch (e) { toast.error(formatApiError(e)); }
  };

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Master Data Guru</h1>
          <p className="text-sm text-slate-500 mt-1">Kelola daftar tenaga pengajar Bimbel AELC & jam siap mengajar.</p>
        </div>
        <Button data-testid="add-teacher-btn" onClick={openAdd} className="bg-blue-600 hover:bg-blue-700 text-white">
          <Plus className="h-4 w-4 mr-2" /> Tambah Guru
        </Button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-left px-4 py-3 font-semibold">Nama Guru</th>
              <th className="text-left px-4 py-3 font-semibold">Mata Pelajaran</th>
              <th className="text-left px-4 py-3 font-semibold">No HP</th>
              <th className="text-left px-4 py-3 font-semibold">Jam Siap Mengajar</th>
              <th className="text-right px-4 py-3 font-semibold">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-400">Belum ada data guru.</td></tr>
            )}
            {list.map((t) => {
              const slots = Array.isArray(t.available_slots) ? t.available_slots : [];
              return (
                <tr key={t.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{t.nama}</td>
                  <td className="px-4 py-3 text-slate-600">{t.mata_pelajaran || "-"}</td>
                  <td className="px-4 py-3 text-slate-600">{t.no_hp || "-"}</td>
                  <td className="px-4 py-3">
                    {slots.length === 0 ? <span className="text-xs text-slate-400 italic">Belum diatur</span> : (
                      <div className="flex flex-wrap gap-1 max-w-md">
                        {slots.map(s => (
                          <span key={s} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-mono font-semibold bg-blue-50 text-blue-800 border border-blue-200">
                            <Clock className="h-3 w-3"/> {s}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Button data-testid={`edit-teacher-${t.id}`} size="icon" variant="ghost" onClick={()=>openEdit(t)}><Pencil className="h-4 w-4"/></Button>
                      <Button data-testid={`delete-teacher-${t.id}`} size="icon" variant="ghost" onClick={()=>remove(t)} className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"><Trash2 className="h-4 w-4"/></Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-white max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "Edit Guru" : "Tambah Guru"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Nama</Label><Input data-testid="teacher-form-nama" value={form.nama} onChange={(e)=>setForm({...form, nama:e.target.value})}/></div>
            <div><Label>Mata Pelajaran</Label><Input data-testid="teacher-form-mapel" value={form.mata_pelajaran} onChange={(e)=>setForm({...form, mata_pelajaran:e.target.value})}/></div>
            <div><Label>No HP</Label><Input data-testid="teacher-form-nohp" value={form.no_hp} onChange={(e)=>setForm({...form, no_hp:e.target.value})}/></div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Jam Siap Mengajar</Label>
                <div className="flex gap-2 text-xs">
                  <button data-testid="slots-select-all" type="button" onClick={selectAll} className="text-blue-600 hover:underline font-semibold">Pilih semua</button>
                  <span className="text-slate-300">·</span>
                  <button data-testid="slots-clear-all" type="button" onClick={clearAll} className="text-slate-500 hover:underline">Kosongkan</button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                {TIME_SLOTS.map(slot => {
                  const checked = form.available_slots.includes(slot);
                  return (
                    <label key={slot} className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm cursor-pointer border ${
                      checked ? "bg-blue-50 border-blue-400 text-blue-900" : "bg-white border-slate-200 text-slate-700 hover:bg-slate-100"
                    }`}
                      style={{transitionProperty:"background-color,border-color",transitionDuration:"150ms"}}>
                      <Checkbox data-testid={`slot-${slot.replace(/[^0-9]/g,'')}`} checked={checked} onCheckedChange={()=>toggleSlot(slot)}/>
                      <span className="font-mono text-xs font-semibold">{slot}</span>
                    </label>
                  );
                })}
              </div>
              <p className="text-xs text-slate-500 mt-1.5">Jam yang dicentang akan muncul di grid Jadwal Siswa untuk guru ini.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={()=>setOpen(false)}>Batal</Button>
            <Button data-testid="teacher-form-save" onClick={save} className="bg-blue-600 hover:bg-blue-700 text-white">Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
