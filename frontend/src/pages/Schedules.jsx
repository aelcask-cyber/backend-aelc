import { useEffect, useMemo, useRef, useState } from "react";
import api, { formatApiError } from "@/lib/api";
import { DAYS, DAYS_ID, TIME_SLOTS, teacherHasSlot, teacherTimes, shortName } from "@/lib/format";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, UserCog, Clock, Printer, FileSpreadsheet } from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import * as XLSX from "xlsx";
import { SchedulePrintSheet } from "@/components/SchedulePrintSheet";

export default function Schedules() {
  const [schedules, setSchedules] = useState([]);
  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [allocations, setAllocations] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ day: "Monday", time_slot: "10.00 - 11.00", student_id: "" });
  const [activeTeacher, setActiveTeacher] = useState("");
  const [printing, setPrinting] = useState(false);
  const printRef = useRef(null);

  const load = async () => {
    try {
      const [sc, st, te, al] = await Promise.all([
        api.get("/schedules"), api.get("/students"), api.get("/teachers"), api.get("/allocations")
      ]);
      setSchedules(sc.data); setStudents(st.data); setTeachers(te.data); setAllocations(al.data);
      if (!activeTeacher && te.data.length > 0) setActiveTeacher(te.data[0].id);
    } catch (e) { toast.error(formatApiError(e)); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const studentMap = useMemo(() => Object.fromEntries(students.map(s => [s.id, s])), [students]);
  const activeTeacherObj = teachers.find(t => t.id === activeTeacher);

  const assignedStudents = useMemo(() => {
    if (!activeTeacher) return [];
    const ids = new Set(allocations.filter(a => a.teacher_id === activeTeacher).map(a => a.student_id));
    return students.filter(s => ids.has(s.id));
  }, [allocations, students, activeTeacher]);

  const openAdd = (day, time_slot) => {
    if (!activeTeacher) return toast.error("Pilih guru dulu");
    setForm({ day, time_slot, student_id: "" });
    setOpen(true);
  };

  const save = async () => {
    if (!activeTeacher || !form.student_id) return toast.error("Pilih siswa");
    try {
      const { data } = await api.post("/schedules", { day: form.day, time_slot: form.time_slot, student_id: form.student_id, teacher_id: activeTeacher });
      setSchedules(prev => [...prev.filter(s => s.id !== data.id), data]);
      toast.success(`Jadwal ${DAYS_ID[form.day]} ${form.time_slot} tersimpan`); setOpen(false);
    } catch (e) { toast.error(formatApiError(e)); }
  };

  const remove = async (id) => {
    try {
      await api.delete(`/schedules/${id}`);
      setSchedules(prev => prev.filter(s => s.id !== id));
      toast.success("Jadwal dihapus");
    }
    catch (e) { toast.error(formatApiError(e)); }
  };

  const filtered = schedules.filter(s => s.teacher_id === activeTeacher);
  const getCell = (day, time) => filtered.filter(s => s.day === day && s.time_slot === time);

  const availableSlots = Array.isArray(activeTeacherObj?.available_slots) ? activeTeacherObj.available_slots : [];
  // Baris grid = jam mengajar guru + jam yang sudah ada jadwalnya (agar tidak ada jadwal tersembunyi)
  const teacherSlots = TIME_SLOTS.filter(t => teacherTimes(availableSlots).includes(t) || filtered.some(s => s.time_slot === t));

  const fileLabel = () => `Jadwal-${(activeTeacherObj?.nama || "Guru").replace(/\s+/g, "-")}-${new Date().toISOString().slice(0,10)}`;

  const printPDF = async () => {
    if (!activeTeacher) return toast.error("Pilih guru dulu");
    toast.loading("Membuat PDF jadwal...", { id: "sch" });
    setPrinting(true);
    try {
      await new Promise(r => setTimeout(r, 350));
      if (!printRef.current) throw new Error("no sheet");
      const canvas = await html2canvas(printRef.current, { scale: 2, backgroundColor: "#ffffff", windowWidth: 1400 });
      // Halaman PDF mengikuti tinggi konten (lebar A4 landscape 297mm) — seluruh Senin–Sabtu utuh tanpa ruang kosong
      const pageW = 297;
      const pageH = (canvas.height * pageW) / canvas.width;
      const pdf = new jsPDF({ orientation: pageH > pageW ? "portrait" : "landscape", unit: "mm", format: [pageW, pageH] });
      pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, pageW, pageH);
      pdf.save(`${fileLabel()}.pdf`);
      toast.success("PDF jadwal berhasil diunduh", { id: "sch" });
    } catch (e) { toast.error("Gagal membuat PDF", { id: "sch" }); }
    setPrinting(false);
  };

  const exportExcel = () => {
    if (!activeTeacher) return toast.error("Pilih guru dulu");
    const header = ["Waktu", ...DAYS.map(d => DAYS_ID[d])];
    const rows = teacherSlots.map(time => [
      time,
      ...DAYS.map(day => getCell(day, time).map(s => {
        const st = studentMap[s.student_id];
        return st ? `${st.nama}${st.kelas ? ` (${st.kelas})` : ""}` : "Siswa terhapus";
      }).join("\n")),
    ]);
    const ws = XLSX.utils.aoa_to_sheet([[`Jadwal Mingguan — ${activeTeacherObj?.nama || ""}`], [], header, ...rows]);
    ws["!cols"] = [{ wch: 14 }, ...DAYS.map(() => ({ wch: 30 }))];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Jadwal");
    XLSX.writeFile(wb, `${fileLabel()}.xlsx`);
    toast.success("Excel jadwal berhasil diunduh");
  };

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Jadwal Siswa</h1>
          <p className="text-sm text-slate-500 mt-1">Jadwal mingguan Senin – Sabtu per guru pengajar.</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <UserCog className="h-4 w-4 text-slate-400"/>
            <Select value={activeTeacher} onValueChange={setActiveTeacher}>
              <SelectTrigger data-testid="schedule-active-teacher" className="w-64">
                <SelectValue placeholder="Pilih Guru"/>
              </SelectTrigger>
              <SelectContent>
                {teachers.length === 0 && <div className="p-2 text-xs text-slate-500">Belum ada data guru.</div>}
                {teachers.map(t => <SelectItem key={t.id} value={t.id}>{t.nama}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button data-testid="print-schedule-btn" onClick={printPDF} disabled={!activeTeacher || teacherSlots.length === 0 || printing}
                  variant="outline" className="border-slate-400 text-slate-700 hover:bg-slate-100">
            <Printer className="h-4 w-4 mr-2"/> Cetak PDF
          </Button>
          <Button data-testid="export-schedule-excel-btn" onClick={exportExcel} disabled={!activeTeacher || teacherSlots.length === 0}
                  variant="outline" className="border-emerald-500 text-emerald-700 hover:bg-emerald-50">
            <FileSpreadsheet className="h-4 w-4 mr-2"/> Export Excel
          </Button>
        </div>
      </div>

      {!activeTeacher ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-xl p-12 text-center">
          <UserCog className="h-10 w-10 text-slate-300 mx-auto mb-2"/>
          <p className="text-sm text-slate-500">Pilih guru untuk melihat jadwal mingguan-nya.</p>
        </div>
      ) : (
        <>
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5 text-sm">
            Menampilkan jadwal untuk <span className="font-bold text-blue-900">{activeTeacherObj?.nama}</span>
            {activeTeacherObj?.mata_pelajaran && <span className="text-blue-700"> · {activeTeacherObj.mata_pelajaran}</span>}
            <span className="text-blue-700"> · {assignedStudents.length} siswa dialokasikan · {availableSlots.length} slot jam · {filtered.length} jadwal</span>
          </div>

          {teacherSlots.length === 0 ? (
            <div className="bg-white border border-dashed border-amber-300 bg-amber-50/50 rounded-xl p-10 text-center">
              <Clock className="h-10 w-10 text-amber-400 mx-auto mb-2"/>
              <p className="text-sm text-slate-700 font-semibold">Belum ada jam mengajar</p>
              <p className="text-xs text-slate-500 mt-1">Buka menu <span className="font-semibold">Data Guru → Edit</span> untuk mengatur jam mengajar guru ini.</p>
            </div>
          ) : (
          <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto" style={{ scrollbarGutter: "stable" }}>
            <div className="px-6 pt-5 pb-3 border-b border-slate-200 bg-white">
              <div className="text-xl font-extrabold text-slate-900">Jadwal Mingguan — {activeTeacherObj?.nama}</div>
              <div className="text-xs text-slate-500">{activeTeacherObj?.mata_pelajaran ? `${activeTeacherObj.mata_pelajaran} · ` : ""}Senin – Sabtu · Bimbel AELC</div>
            </div>
            <table className="w-full text-sm min-w-[1100px]">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold w-28">Waktu</th>
                  {DAYS.map(d => <th key={d} className="text-left px-4 py-3 font-semibold">{DAYS_ID[d]}</th>)}
                </tr>
              </thead>
              <tbody>
                {teacherSlots.map(time => (
                  <tr key={time} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-mono text-xs text-slate-700 font-semibold bg-slate-50/50">{time}</td>
                    {DAYS.map(day => {
                      const items = getCell(day, time);
                      const available = teacherHasSlot(availableSlots, day, time);
                      return (
                        <td key={day} className={`px-2 py-2 align-top border-l border-slate-100 min-w-[140px] ${available ? "" : "bg-slate-50/70"}`}>
                          <div className="space-y-1.5">
                            {items.map(s => {
                              const st = studentMap[s.student_id];
                              return (
                                <div key={s.id} data-testid={`schedule-card-${s.id}`} className="group bg-blue-50 border border-blue-200 rounded-lg px-2.5 py-2 text-xs">
                                  <div className="flex items-start justify-between gap-1">
                                    <div className="flex-1 min-w-0">
                                      <div className="font-semibold text-blue-900 leading-snug break-words" title={st?.nama}>
                                        {st ? shortName(st.nama) : <span className="text-rose-600 italic">Siswa terhapus</span>}
                                      </div>
                                      <div className="text-blue-700 text-[11px]">{st?.kelas}</div>
                                    </div>
                                    <button data-testid={`delete-schedule-${s.id}`} onClick={()=>remove(s.id)}
                                            className="opacity-0 group-hover:opacity-100 text-rose-600 hover:text-rose-700"
                                            style={{transitionProperty:"opacity",transitionDuration:"150ms"}}>
                                      <Trash2 className="h-3.5 w-3.5"/>
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                            {available ? (
                              <button data-testid={`add-schedule-${day}-${time}`} onClick={()=>openAdd(day, time)}
                                className="w-full flex items-center justify-center gap-1 py-1.5 rounded-md border border-dashed border-slate-300 text-slate-400 hover:border-blue-400 hover:text-blue-600 text-xs"
                                style={{transitionProperty:"border-color,color",transitionDuration:"150ms"}}>
                                <Plus className="h-3 w-3"/> Tambah
                              </button>
                            ) : items.length === 0 && (
                              <div data-testid={`unavailable-${day}-${time}`} className="text-center text-[10px] text-slate-300 py-1.5 select-none">—</div>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}
        </>
      )}

      {printing && (
        <div style={{ position: "fixed", left: -99999, top: 0 }}>
          <SchedulePrintSheet innerRef={printRef} teacher={activeTeacherObj} times={teacherSlots} getCell={getCell}
                              studentMap={studentMap} isAvailable={(d, t) => teacherHasSlot(availableSlots, d, t)}/>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-white">
          <DialogHeader><DialogTitle>Tambah Jadwal — {DAYS_ID[form.day]} · {form.time_slot}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
              Guru: <span className="font-semibold text-slate-900">{activeTeacherObj?.nama}</span>
            </div>
            <div>
              <Label>Siswa (dari alokasi guru)</Label>
              <Select value={form.student_id} onValueChange={(v)=>setForm({...form, student_id:v})}>
                <SelectTrigger data-testid="schedule-form-student"><SelectValue placeholder="Pilih siswa"/></SelectTrigger>
                <SelectContent>
                  {assignedStudents.length === 0 && <div className="p-2 text-xs text-slate-500">Belum ada siswa dialokasikan ke guru ini.</div>}
                  {assignedStudents.map(s=><SelectItem key={s.id} value={s.id}>#{s.no_urut} {s.nama} — {s.kelas}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={()=>setOpen(false)}>Batal</Button>
            <Button data-testid="schedule-form-save" onClick={save} className="bg-blue-600 hover:bg-blue-700 text-white">Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
