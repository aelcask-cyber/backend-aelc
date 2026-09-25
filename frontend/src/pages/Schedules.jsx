import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import api, { formatApiError } from "@/lib/api";
import { DAYS_ID, TIME_SLOTS, teacherHasSlot, teacherTimes } from "@/lib/format";
import { scheduleFileLabel, scheduleElementToPdf, scheduleToExcel } from "@/lib/scheduleExport";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { UserCog, Clock, Printer, FileSpreadsheet } from "lucide-react";
import { SchedulePrintSheet } from "@/components/SchedulePrintSheet";
import { ScheduleGrid } from "@/components/ScheduleGrid";

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

  const load = useCallback(async () => {
    try {
      const [sc, st, te, al] = await Promise.all([
        api.get("/schedules"), api.get("/students"), api.get("/teachers"), api.get("/allocations"),
      ]);
      setSchedules(sc.data); setStudents(st.data); setTeachers(te.data); setAllocations(al.data);
      setActiveTeacher(prev => prev || te.data[0]?.id || "");
    } catch (e) { toast.error(formatApiError(e)); }
  }, []);
  useEffect(() => { load(); }, [load]);

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
    } catch (e) { toast.error(formatApiError(e)); }
  };

  const filtered = schedules.filter(s => s.teacher_id === activeTeacher);
  const getCell = (day, time) => filtered.filter(s => s.day === day && s.time_slot === time);
  const availableSlots = Array.isArray(activeTeacherObj?.available_slots) ? activeTeacherObj.available_slots : [];
  const isAvailable = (day, time) => teacherHasSlot(availableSlots, day, time);
  // Baris grid = jam mengajar guru + jam yang sudah ada jadwalnya (agar tidak ada jadwal tersembunyi)
  const teacherSlots = TIME_SLOTS.filter(t => teacherTimes(availableSlots).includes(t) || filtered.some(s => s.time_slot === t));

  const printPDF = async () => {
    if (!activeTeacher) return toast.error("Pilih guru dulu");
    toast.loading("Membuat PDF jadwal...", { id: "sch" });
    setPrinting(true);
    try {
      await new Promise(r => setTimeout(r, 350));
      if (!printRef.current) throw new Error("no sheet");
      await scheduleElementToPdf(printRef.current, scheduleFileLabel(activeTeacherObj));
      toast.success("PDF jadwal berhasil diunduh", { id: "sch" });
    } catch (e) { toast.error("Gagal membuat PDF", { id: "sch" }); }
    setPrinting(false);
  };

  const exportExcel = () => {
    if (!activeTeacher) return toast.error("Pilih guru dulu");
    scheduleToExcel({ teacher: activeTeacherObj, times: teacherSlots, getCell, studentMap });
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
              <SelectTrigger data-testid="schedule-active-teacher" className="w-64"><SelectValue placeholder="Pilih Guru"/></SelectTrigger>
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
            <ScheduleGrid teacher={activeTeacherObj} times={teacherSlots} getCell={getCell} studentMap={studentMap}
                          isAvailable={isAvailable} onAdd={openAdd} onDelete={remove}/>
          )}
        </>
      )}

      {printing && (
        <div style={{ position: "fixed", left: -99999, top: 0 }}>
          <SchedulePrintSheet innerRef={printRef} teacher={activeTeacherObj} times={teacherSlots} getCell={getCell}
                              studentMap={studentMap} isAvailable={isAvailable}/>
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
              <Select value={form.student_id} onValueChange={(v) => setForm({ ...form, student_id: v })}>
                <SelectTrigger data-testid="schedule-form-student"><SelectValue placeholder="Pilih siswa"/></SelectTrigger>
                <SelectContent>
                  {assignedStudents.length === 0 && <div className="p-2 text-xs text-slate-500">Belum ada siswa dialokasikan ke guru ini.</div>}
                  {assignedStudents.map(s => <SelectItem key={s.id} value={s.id}>#{s.no_urut} {s.nama} — {s.kelas}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
            <Button data-testid="schedule-form-save" onClick={save} className="bg-blue-600 hover:bg-blue-700 text-white">Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
