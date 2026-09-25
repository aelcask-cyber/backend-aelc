import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import api, { formatApiError } from "@/lib/api";
import { fmtIDR } from "@/lib/format";
import { useCompany } from "@/lib/company";
import { EMPTY_ALLOCATION, calcTotal } from "@/lib/allocations";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, MessageCircle, Printer } from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { AllocationTable } from "@/components/allocations/AllocationTable";
import { AllocationReport } from "@/components/allocations/AllocationReport";
import { AllocationFormDialog } from "@/components/allocations/AllocationFormDialog";
import { ReminderDialog } from "@/components/allocations/ReminderDialog";

const sumTotal = (rows) => rows.reduce((s, a) => s + calcTotal(a), 0);

export default function Allocations() {
  const [allocs, setAllocs] = useState([]);
  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_ALLOCATION);
  const [filterTeacher, setFilterTeacher] = useState("all");
  const [reminderOpen, setReminderOpen] = useState(false);
  const reportRef = useRef(null);
  const company = useCompany();

  const load = useCallback(async () => {
    try {
      const [a, s, t] = await Promise.all([api.get("/allocations"), api.get("/students"), api.get("/teachers")]);
      setAllocs(a.data); setStudents(s.data); setTeachers(t.data);
    } catch (e) { toast.error(formatApiError(e)); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const studentMap = useMemo(() => Object.fromEntries(students.map(s => [s.id, s])), [students]);
  const teacherMap = useMemo(() => Object.fromEntries(teachers.map(t => [t.id, t])), [teachers]);

  const openAdd = () => { setEditing(null); setForm(EMPTY_ALLOCATION); setOpen(true); };
  const openEdit = (a) => {
    setEditing(a);
    setForm({
      teacher_id: a.teacher_id, student_id: a.student_id,
      pertemuan: a.pertemuan || 0, biaya: a.biaya || 0,
      buku: a.buku || "", harga_buku: a.harga_buku || 0,
      no_invoice: a.no_invoice || "", payment_status: a.payment_status || "Unpaid",
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.teacher_id || !form.student_id) return toast.error("Pilih guru dan siswa");
    try {
      const payload = { ...form, pertemuan: Number(form.pertemuan), biaya: Number(form.biaya), harga_buku: Number(form.harga_buku || 0) };
      if (editing) { await api.put(`/allocations/${editing.id}`, payload); toast.success("Alokasi diperbarui"); }
      else { await api.post("/allocations", payload); toast.success("Alokasi ditambahkan"); }
      setOpen(false); load();
    } catch (e) { toast.error(formatApiError(e)); }
  };

  const remove = async (a) => {
    if (!window.confirm("Hapus alokasi ini?")) return;
    try { await api.delete(`/allocations/${a.id}`); toast.success("Alokasi dihapus"); load(); }
    catch (e) { toast.error(formatApiError(e)); }
  };

  const togglePaid = async (a) => {
    try {
      const next = a.payment_status === "Paid" ? "Unpaid" : "Paid";
      await api.put(`/allocations/${a.id}`, { ...a, payment_status: next });
      toast.success(`Status diubah ke ${next}`); load();
    } catch (e) { toast.error(formatApiError(e)); }
  };

  const filtered = filterTeacher === "all" ? allocs : allocs.filter(a => a.teacher_id === filterTeacher);
  const totals = {
    paid: sumTotal(filtered.filter(a => a.payment_status === "Paid")),
    unpaid: sumTotal(filtered.filter(a => a.payment_status === "Unpaid")),
    total: sumTotal(filtered),
  };
  const scopeLabel = filterTeacher === "all" ? "Semua Guru" : (teacherMap[filterTeacher]?.nama || "-");

  const unpaidList = allocs
    .filter(a => a.payment_status === "Unpaid")
    .map(a => ({ alloc: a, student: studentMap[a.student_id] }))
    .filter(x => x.student && x.student.no_hp);

  const printLaporan = async () => {
    if (!reportRef.current) return;
    toast.loading("Membuat laporan PDF...", { id: "rpt" });
    try {
      const canvas = await html2canvas(reportRef.current, { scale: 2, backgroundColor: "#ffffff" });
      const pageW = 297, pageH = 210, imgW = pageW - 10;
      const imgH = (canvas.height * imgW) / canvas.width;
      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      if (imgH <= pageH - 10) {
        pdf.addImage(canvas.toDataURL("image/png"), "PNG", 5, 5, imgW, imgH);
      } else {
        const pxPerMM = canvas.width / imgW;
        const pageChunkPx = (pageH - 10) * pxPerMM;
        let sY = 0;
        while (sY < canvas.height) {
          const chunkH = Math.min(pageChunkPx, canvas.height - sY);
          const tmp = document.createElement("canvas");
          tmp.width = canvas.width; tmp.height = chunkH;
          tmp.getContext("2d").drawImage(canvas, 0, sY, canvas.width, chunkH, 0, 0, canvas.width, chunkH);
          pdf.addImage(tmp.toDataURL("image/png"), "PNG", 5, 5, imgW, chunkH / pxPerMM);
          sY += chunkH;
          if (sY < canvas.height) pdf.addPage("a4", "landscape");
        }
      }
      pdf.save(`Laporan-Pendapatan-${scopeLabel.replace(/\s+/g, "-")}-${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success("Laporan berhasil diunduh", { id: "rpt" });
    } catch (e) { toast.error("Gagal membuat PDF", { id: "rpt" }); }
  };

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Data Siswa per Guru</h1>
          <p className="text-sm text-slate-500 mt-1">Alokasikan siswa kepada guru pengajar dan kelola tagihan.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button data-testid="print-laporan-btn" onClick={printLaporan} variant="outline" className="border-slate-400 text-slate-700 hover:bg-slate-100">
            <Printer className="h-4 w-4 mr-2" /> Cetak Laporan
          </Button>
          <Button data-testid="bulk-reminder-btn" onClick={() => setReminderOpen(true)} variant="outline" className="border-emerald-500 text-emerald-700 hover:bg-emerald-50">
            <MessageCircle className="h-4 w-4 mr-2" /> Reminder Unpaid
          </Button>
          <Button data-testid="add-allocation-btn" onClick={openAdd} className="bg-blue-600 hover:bg-blue-700 text-white">
            <Plus className="h-4 w-4 mr-2" /> Tambah Alokasi
          </Button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl">
        <div className="p-4 border-b border-slate-200 flex flex-wrap gap-3 items-center">
          <Select value={filterTeacher} onValueChange={setFilterTeacher}>
            <SelectTrigger data-testid="filter-teacher" className="w-64"><SelectValue placeholder="Filter Guru"/></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Guru</SelectItem>
              {teachers.map(t => <SelectItem key={t.id} value={t.id}>{t.nama}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="ml-auto grid grid-cols-3 gap-3 text-xs">
            <div className="px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200">
              <div className="text-emerald-700">Paid (Diterima)</div>
              <div data-testid="alloc-summary-paid" className="font-mono font-bold text-emerald-800">{fmtIDR(totals.paid)}</div>
            </div>
            <div className="px-3 py-2 rounded-lg bg-rose-50 border border-rose-200">
              <div className="text-rose-700">Unpaid</div>
              <div data-testid="alloc-summary-unpaid" className="font-mono font-bold text-rose-800">{fmtIDR(totals.unpaid)}</div>
            </div>
            <div className="px-3 py-2 rounded-lg bg-blue-50 border border-blue-200">
              <div className="text-blue-700">Grand Total (Paid + Unpaid)</div>
              <div data-testid="alloc-summary-total" className="font-mono font-bold text-blue-800">{fmtIDR(totals.total)}</div>
            </div>
          </div>
        </div>
        <AllocationTable rows={filtered} studentMap={studentMap} teacherMap={teacherMap} onEdit={openEdit} onDelete={remove} onTogglePaid={togglePaid}/>
      </div>

      <AllocationReport innerRef={reportRef} rows={filtered} studentMap={studentMap} teacherMap={teacherMap} scopeLabel={scopeLabel} totals={totals}/>
      <AllocationFormDialog open={open} onOpenChange={setOpen} editing={editing} form={form} setForm={setForm}
                            teachers={teachers} students={students} studentMap={studentMap} onSave={save}/>
      <ReminderDialog open={reminderOpen} onOpenChange={setReminderOpen} unpaidList={unpaidList} company={company}/>
    </div>
  );
}
