import { useCallback, useEffect, useState } from "react";
import api, { formatApiError } from "@/lib/api";
import { DAYS, DAYS_ID, parseSlot, normalizeSlots, capWords } from "@/lib/format";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Clock } from "lucide-react";
import { TeacherSlotPicker } from "@/components/TeacherSlotPicker";

const empty = { nama: "", mata_pelajaran: "", no_hp: "", available_slots: [] };

export default function Teachers() {
  const [list, setList] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);

  const load = useCallback(async () => {
    try { const { data } = await api.get("/teachers"); setList(data); }
    catch (e) { toast.error(formatApiError(e)); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const openAdd = () => { setEditing(null); setForm(empty); setOpen(true); };

  const openEdit = (t) => {
    setEditing(t);
    setForm({
      nama: t.nama,
      mata_pelajaran: t.mata_pelajaran || "",
      no_hp: t.no_hp || "",
      available_slots: normalizeSlots(t.available_slots),
    });
    setOpen(true);
  };

  const groupByDay = (slots) => {
    const g = {};
    normalizeSlots(slots).forEach((s) => { const p = parseSlot(s); (g[p.day] ||= []).push(p.time); });
    return DAYS.filter(d => g[d]).map(d => ({ day: d, times: g[d] }));
  };

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
          <p className="text-sm text-slate-500 mt-1">Kelola daftar tenaga pengajar Bimbel AELC & jam mengajar per hari.</p>
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
              <th className="text-left px-4 py-3 font-semibold">Jam Mengajar</th>
              <th className="text-right px-4 py-3 font-semibold">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-400">Belum ada data guru.</td></tr>
            )}
            {list.map((t) => {
              const groups = groupByDay(t.available_slots);
              return (
                <tr key={t.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{t.nama}</td>
                  <td className="px-4 py-3 text-slate-600">{t.mata_pelajaran || "-"}</td>
                  <td className="px-4 py-3 text-slate-600">{t.no_hp || "-"}</td>
                  <td className="px-4 py-3">
                    {groups.length === 0 ? <span className="text-xs text-slate-400 italic">Belum diatur</span> : (
                      <div className="space-y-1 max-w-lg" data-testid={`teacher-slots-${t.id}`}>
                        {groups.map(g => (
                          <div key={g.day} className="flex flex-wrap items-center gap-1">
                            <span className="text-[11px] font-bold text-slate-700 w-12">{DAYS_ID[g.day]}</span>
                            {g.times.map(time => (
                              <span key={time} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-blue-50 text-blue-800 border border-blue-200">
                                <Clock className="h-2.5 w-2.5"/> {time.replace(/\s/g, "")}
                              </span>
                            ))}
                          </div>
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
        <DialogContent className="bg-white max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Edit Guru" : "Tambah Guru"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div><Label>Nama</Label><Input data-testid="teacher-form-nama" value={form.nama} onChange={(e)=>setForm({...form, nama:capWords(e.target.value)})}/></div>
              <div><Label>Mata Pelajaran</Label><Input data-testid="teacher-form-mapel" value={form.mata_pelajaran} onChange={(e)=>setForm({...form, mata_pelajaran:capWords(e.target.value)})}/></div>
              <div><Label>No HP</Label><Input data-testid="teacher-form-nohp" value={form.no_hp} onChange={(e)=>setForm({...form, no_hp:e.target.value})}/></div>
            </div>
            <TeacherSlotPicker slots={form.available_slots} onChange={(available_slots) => setForm(f => ({ ...f, available_slots }))}/>
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
