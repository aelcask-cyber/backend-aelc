import { useEffect, useMemo, useRef, useState } from "react";
import api, { formatApiError } from "@/lib/api";
import { DAYS, DAYS_ID } from "@/lib/format";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, UserCog, Clock, Printer } from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

export default function Schedules() {
  const [schedules, setSchedules] = useState([]);
  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [allocations, setAllocations] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ day: "Monday", time_slot: "10.00 - 11.00", student_id: "" });
  const [activeTeacher, setActiveTeacher] = useState("");
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
      await api.post("/schedules", { ...form, teacher_id: activeTeacher });
      toast.success("Jadwal ditambahkan"); setOpen(false); load();
    } catch (e) { toast.error(formatApiError(e)); }
  };

  const remove = async (id) => {
    try { await api.delete(`/schedules/${id}`); toast.success("Jadwal dihapus"); load(); }
    catch (e) { toast.error(formatApiError(e)); }
  };

  const filtered = schedules.filter(s => s.teacher_id === activeTeacher);
  const getCell = (day, time) => filtered.filter(s => s.day === day && s.time_slot === time);

  const teacherSlots = Array.isArray(activeTeacherObj?.available_slots) && activeTeacherObj.available_slots.length > 0
    ? activeTeacherObj.available_slots
    : [];

  const printPDF = async () => {
    if (!activeTeacher) return toast.error("Pilih guru dulu");
    if (!printRef.current) return;
    toast.loading("Membuat PDF jadwal...", { id: "sch" });
    try {
      const canvas = await html2canvas(printRef.current, { scale: 2, backgroundColor: "#ffffff" });
      const imgData = canvas.toDataURL("image/png");
      // A4 landscape full-page (297 x 210 mm), fill entire width
      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const pageW = 297, pageH = 210;
      const imgW = pageW;
      const imgH = (canvas.height * imgW) / canvas.width;
      if (imgH <= pageH) {
        pdf.addImage(imgData, "PNG", 0, 0, imgW, imgH);
      } else {
        // paginate: split canvas vertically per page
        const pxPerMM = canvas.width / imgW;
        const pageChunkPx = pageH * pxPerMM;
        let sY = 0;
        while (sY < canvas.height) {
          const chunkH = Math.min(pageChunkPx, canvas.height - sY);
          const tmp = document.createElement("canvas");
          tmp.width = canvas.width; tmp.height = chunkH;
          tmp.getContext("2d").drawImage(canvas, 0, sY, canvas.width, chunkH, 0, 0, canvas.width, chunkH);
          pdf.addImage(tmp.toDataURL("image/png"), "PNG", 0, 0, imgW, chunkH / pxPerMM);
          sY += chunkH;
          if (sY < canvas.height) pdf.addPage("a4", "landscape");
        }
      }
      const label = (activeTeacherObj?.nama || "Guru").replace(/\s+/g, "-");
      pdf.save(`Jadwal-${label}-${new Date().toISOString().slice(0,10)}.pdf`);
      toast.success("PDF jadwal berhasil diunduh", { id: "sch" });
    } catch (e) { toast.error("Gagal membuat PDF", { id: "sch" }); }
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
          <Button data-testid="print-schedule-btn" onClick={printPDF} disabled={!activeTeacher || teacherSlots.length === 0}
                  variant="outline" className="border-slate-400 text-slate-700 hover:bg-slate-100">
            <Printer className="h-4 w-4 mr-2"/> Cetak PDF A4
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
            <span className="text-blue-700"> · {assignedStudents.length} siswa dialokasikan · {teacherSlots.length} slot jam</span>
          </div>

          {teacherSlots.length === 0 ? (
            <div className="bg-white border border-dashed border-amber-300 bg-amber-50/50 rounded-xl p-10 text-center">
              <Clock className="h-10 w-10 text-amber-400 mx-auto mb-2"/>
              <p className="text-sm text-slate-700 font-semibold">Belum ada jam siap mengajar</p>
              <p className="text-xs text-slate-500 mt-1">Buka menu <span className="font-semibold">Data Guru → Edit</span> untuk mengatur jam siap mengajar guru ini.</p>
            </div>
          ) : (
          <div ref={printRef} className="bg-white border border-slate-200 rounded-xl overflow-x-auto" style={{ scrollbarGutter: "stable" }}>
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
                      return (
                        <td key={day} className="px-2 py-2 align-top border-l border-slate-100 min-w-[140px]">
                          <div className="space-y-1.5">
                            {items.map(s => {
                              const st = studentMap[s.student_id];
                              return (
                                <div key={s.id} className="group bg-blue-50 border border-blue-200 rounded-lg px-2.5 py-2 text-xs">
                                  <div className="flex items-start justify-between gap-1">
                                    <div className="flex-1 min-w-0">
                                      <div className="font-semibold text-blue-900 truncate">#{st?.no_urut} {st?.nama || "?"}</div>
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
                            <button data-testid={`add-schedule-${day}-${time}`} onClick={()=>openAdd(day, time)}
                              className="w-full flex items-center justify-center gap-1 py-1.5 rounded-md border border-dashed border-slate-300 text-slate-400 hover:border-blue-400 hover:text-blue-600 text-xs"
                              style={{transitionProperty:"border-color,color",transitionDuration:"150ms"}}>
                              <Plus className="h-3 w-3"/> Tambah
                            </button>
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
