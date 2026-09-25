import { useEffect, useState } from "react";
import api, { formatApiError } from "@/lib/api";
import { TIME_SLOTS, DAYS, DAYS_ID, slotKey, parseSlot, sortSlots, capWords } from "@/lib/format";
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
  // Slot lama tanpa hari dikonversi menjadi slot per hari (semua hari) saat edit.
  const normalizeSlots = (slots) => {
    const out = new Set();
    (slots || []).forEach((s) => {
      const p = parseSlot(s);
      if (!TIME_SLOTS.includes(p.time)) return;
      if (p.day) out.add(s); else DAYS.forEach((d) => out.add(slotKey(d, p.time)));
    });
    return sortSlots([...out]);
  };

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

  const toggleSlot = (key) => {
    setForm(f => {
      const has = f.available_slots.includes(key);
      const next = has ? f.available_slots.filter(s => s !== key) : [...f.available_slots, key];
      return { ...f, available_slots: sortSlots(next) };
    });
  };

  const setDay = (day, on) => {
    setForm(f => {
      const others = f.available_slots.filter(s => parseSlot(s).day !== day);
      const next = on ? [...others, ...TIME_SLOTS.map(t => slotKey(day, t))] : others;
      return { ...f, available_slots: sortSlots(next) };
    });
  };

  const selectAll = () => setForm(f => ({ ...f, available_slots: sortSlots(DAYS.flatMap(d => TIME_SLOTS.map(t => slotKey(d, t)))) }));
  const clearAll = () => setForm(f => ({ ...f, available_slots: [] }));

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
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Jam Mengajar <span className="text-slate-400 font-normal">({form.available_slots.length} slot dipilih)</span></Label>
                <div className="flex gap-2 text-xs">
                  <button data-testid="slots-select-all" type="button" onClick={selectAll} className="text-blue-600 hover:underline font-semibold">Pilih semua</button>
                  <span className="text-slate-300">·</span>
                  <button data-testid="slots-clear-all" type="button" onClick={clearAll} className="text-slate-500 hover:underline">Kosongkan</button>
                </div>
              </div>
              <div className="space-y-2">
                {DAYS.map(day => {
                  const dayCount = form.available_slots.filter(s => parseSlot(s).day === day).length;
                  const allDay = dayCount === TIME_SLOTS.length;
                  return (
                    <div key={day} className="border border-slate-200 rounded-lg overflow-hidden" data-testid={`slot-group-${day}`}>
                      <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-b border-slate-200">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <Checkbox data-testid={`slot-day-all-${day}`} checked={allDay ? true : dayCount > 0 ? "indeterminate" : false}
                                    onCheckedChange={(v)=>setDay(day, v === true)}/>
                          <span className="text-sm font-bold text-slate-800">{DAYS_ID[day]}</span>
                        </label>
                        <span className="text-[11px] text-slate-500">{dayCount}/{TIME_SLOTS.length} jam</span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-2">
                        {TIME_SLOTS.map(time => {
                          const key = slotKey(day, time);
                          const checked = form.available_slots.includes(key);
                          return (
                            <label key={key} title={`${DAYS_ID[day]} - ${time.replace(/\s/g, "")}`}
                              className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm cursor-pointer border ${
                                checked ? "bg-blue-50 border-blue-400 text-blue-900" : "bg-white border-slate-200 text-slate-700 hover:bg-slate-100"
                              }`}
                              style={{transitionProperty:"background-color,border-color",transitionDuration:"150ms"}}>
                              <Checkbox data-testid={`slot-${day}-${time.replace(/[^0-9]/g,'')}`} checked={checked} onCheckedChange={()=>toggleSlot(key)}/>
                              <span className="font-mono text-[11px] font-semibold">{time}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-slate-500 mt-1.5">Contoh: "Senin - 10.00-11.00". Jam yang dicentang akan muncul di grid Jadwal Siswa untuk guru ini pada hari tersebut.</p>
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
