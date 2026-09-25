import { useEffect, useMemo, useState, useRef } from "react";
import api, { formatApiError } from "@/lib/api";
import { fmtIDR, fmtDate, capWords } from "@/lib/format";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, Send, MessageCircle, Printer, BookOpen } from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

const empty = { teacher_id: "", student_id: "", pertemuan: 0, biaya: 0, buku: "", harga_buku: 0, no_invoice: "", payment_status: "Unpaid" };

const calcTotal = (a) => (Number(a.biaya) || 0) + (Number(a.harga_buku) || 0);

export default function Allocations() {
  const [allocs, setAllocs] = useState([]);
  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [filterTeacher, setFilterTeacher] = useState("all");
  const [reminderOpen, setReminderOpen] = useState(false);
  const reportRef = useRef(null);

  const load = async () => {
    try {
      const [a, s, t] = await Promise.all([api.get("/allocations"), api.get("/students"), api.get("/teachers")]);
      setAllocs(a.data); setStudents(s.data); setTeachers(t.data);
    } catch (e) { toast.error(formatApiError(e)); }
  };
  useEffect(() => { load(); }, []);

  const studentMap = useMemo(() => Object.fromEntries(students.map(s => [s.id, s])), [students]);
  const teacherMap = useMemo(() => Object.fromEntries(teachers.map(t => [t.id, t])), [teachers]);

  const openAdd = () => { setEditing(null); setForm(empty); setOpen(true); };
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

  const onSelectStudent = (id) => {
    const s = studentMap[id];
    setForm(f => ({ ...f, student_id: id, biaya: s?.biaya || f.biaya }));
  };

  const save = async () => {
    if (!form.teacher_id || !form.student_id) return toast.error("Pilih guru dan siswa");
    try {
      const payload = {
        ...form,
        pertemuan: Number(form.pertemuan),
        biaya: Number(form.biaya),
        harga_buku: Number(form.harga_buku || 0),
      };
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
  const filteredTotal = filtered.reduce((s, a) => s + calcTotal(a), 0);
  const filteredPaid = filtered.filter(a => a.payment_status === "Paid").reduce((s, a) => s + calcTotal(a), 0);
  const filteredUnpaid = filtered.filter(a => a.payment_status === "Unpaid").reduce((s, a) => s + calcTotal(a), 0);

  const unpaidList = allocs
    .filter(a => a.payment_status === "Unpaid")
    .map(a => ({ alloc: a, student: studentMap[a.student_id] }))
    .filter(x => x.student && x.student.no_hp);

  const buildWaLink = (student, alloc) => {
    let phone = String(student.no_hp).replace(/\D/g, "");
    if (phone.startsWith("0")) phone = "62" + phone.slice(1);
    const total = calcTotal(alloc);
    const msg = `Halo Bapak/Ibu wali dari ${student.nama},\n\nMengingatkan kembali tagihan Bimbel AELC:\n\n*No Invoice*: ${alloc.no_invoice}\n*Program*: ${student.program_bimbel}\n*Pertemuan*: ${alloc.pertemuan}x\n*Total*: ${fmtIDR(total)}\n\nMohon transfer ke:\n*Bank BCA*\na/n CV ARITA YASA NUSANTARA\n\nTerima kasih 🙏`;
    return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
  };

  const printLaporan = async () => {
    if (!reportRef.current) return;
    toast.loading("Membuat laporan PDF...", { id: "rpt" });
    try {
      const canvas = await html2canvas(reportRef.current, { scale: 2, backgroundColor: "#ffffff" });
      const imgData = canvas.toDataURL("image/png");
      // Landscape A4: 297 x 210 mm
      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const pageW = 297, pageH = 210;
      const imgW = pageW - 10;
      const imgH = (canvas.height * imgW) / canvas.width;
      let y = 5;
      if (imgH <= pageH - 10) {
        pdf.addImage(imgData, "PNG", 5, y, imgW, imgH);
      } else {
        // paginate
        let sY = 0;
        const pxPerMM = canvas.width / imgW;
        const pageChunkPx = (pageH - 10) * pxPerMM;
        while (sY < canvas.height) {
          const chunkH = Math.min(pageChunkPx, canvas.height - sY);
          const tmp = document.createElement("canvas");
          tmp.width = canvas.width; tmp.height = chunkH;
          tmp.getContext("2d").drawImage(canvas, 0, sY, canvas.width, chunkH, 0, 0, canvas.width, chunkH);
          const chunkData = tmp.toDataURL("image/png");
          pdf.addImage(chunkData, "PNG", 5, 5, imgW, (chunkH / pxPerMM));
          sY += chunkH;
          if (sY < canvas.height) pdf.addPage("a4", "landscape");
        }
      }
      const teacherLabel = filterTeacher === "all" ? "Semua-Guru" : (teacherMap[filterTeacher]?.nama || "Guru").replace(/\s+/g, "-");
      pdf.save(`Laporan-Pendapatan-${teacherLabel}-${new Date().toISOString().slice(0,10)}.pdf`);
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
          <Button data-testid="bulk-reminder-btn" onClick={()=>setReminderOpen(true)} variant="outline" className="border-emerald-500 text-emerald-700 hover:bg-emerald-50">
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
              <div data-testid="alloc-summary-paid" className="font-mono font-bold text-emerald-800">{fmtIDR(filteredPaid)}</div>
            </div>
            <div className="px-3 py-2 rounded-lg bg-rose-50 border border-rose-200">
              <div className="text-rose-700">Unpaid</div>
              <div data-testid="alloc-summary-unpaid" className="font-mono font-bold text-rose-800">{fmtIDR(filteredUnpaid)}</div>
            </div>
            <div className="px-3 py-2 rounded-lg bg-blue-50 border border-blue-200">
              <div className="text-blue-700">Grand Total (Paid + Unpaid)</div>
              <div data-testid="alloc-summary-total" className="font-mono font-bold text-blue-800">{fmtIDR(filteredTotal)}</div>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto" style={{ scrollbarGutter: "stable" }}>
          <table className="w-full text-sm min-w-[1200px]">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="text-left px-4 py-3 font-semibold">Guru</th>
                <th className="text-left px-4 py-3 font-semibold">No</th>
                <th className="text-left px-4 py-3 font-semibold">Siswa</th>
                <th className="text-left px-4 py-3 font-semibold">Kelas / Program</th>
                <th className="text-right px-4 py-3 font-semibold">Pertemuan</th>
                <th className="text-right px-4 py-3 font-semibold">Biaya/Bulan</th>
                <th className="text-left px-4 py-3 font-semibold">Buku</th>
                <th className="text-right px-4 py-3 font-semibold">Harga Buku</th>
                <th className="text-right px-4 py-3 font-semibold">Total</th>
                <th className="text-left px-4 py-3 font-semibold">No Invoice</th>
                <th className="text-center px-4 py-3 font-semibold">Pembayaran</th>
                <th className="text-right px-4 py-3 font-semibold">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan={12} className="px-4 py-10 text-center text-slate-400">Belum ada alokasi.</td></tr>}
              {filtered.map((a) => {
                const s = studentMap[a.student_id];
                const t = teacherMap[a.teacher_id];
                const total = calcTotal(a);
                return (
                  <tr key={a.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">{t?.nama || "-"}</td>
                    <td className="px-4 py-3 text-slate-700">{s?.no_urut ?? "-"}</td>
                    <td className="px-4 py-3 text-slate-900">{s?.nama || "-"}</td>
                    <td className="px-4 py-3 text-slate-600 text-xs">
                      {s ? <><div>{s.kelas} · {s.program_kelas}</div><div className="text-slate-400">{s.program_bimbel}</div></> : "-"}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">{a.pertemuan}</td>
                    <td className="px-4 py-3 text-right font-mono">{fmtIDR(a.biaya)}</td>
                    <td className="px-4 py-3 text-slate-700 text-xs">{a.buku || "-"}</td>
                    <td className="px-4 py-3 text-right font-mono">{a.harga_buku ? fmtIDR(a.harga_buku) : "-"}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">{fmtIDR(total)}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-700">{a.no_invoice}</td>
                    <td className="px-4 py-3 text-center">
                      <button data-testid={`toggle-payment-${a.id}`} onClick={()=>togglePaid(a)}
                        className={a.payment_status === "Paid"
                          ? "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200 hover:bg-emerald-200"
                          : "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200 hover:bg-rose-200"}
                        style={{transitionProperty:"background-color",transitionDuration:"150ms"}}>
                        {a.payment_status}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button data-testid={`edit-allocation-${a.id}`} size="icon" variant="ghost" onClick={()=>openEdit(a)}><Pencil className="h-4 w-4"/></Button>
                        <Button data-testid={`delete-allocation-${a.id}`} size="icon" variant="ghost" onClick={()=>remove(a)} className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"><Trash2 className="h-4 w-4"/></Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Offscreen printable report */}
      <div style={{position: "fixed", left: -99999, top: 0, width: 1400, background: "#fff"}}>
        <div ref={reportRef} className="p-8 bg-white" style={{width: 1400, color: "#0F172A"}}>
          <div className="flex justify-between items-start pb-4 border-b-2 border-blue-600">
            <div>
              <div className="text-2xl font-extrabold text-slate-900">Laporan Pendapatan — Bimbel AELC</div>
              <div className="text-sm text-slate-600">{filterTeacher === "all" ? "Semua Guru" : (teacherMap[filterTeacher]?.nama || "-")} · Dicetak {fmtDate(new Date().toISOString())}</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-slate-500">Grand Total (Paid + Unpaid)</div>
              <div className="text-2xl font-extrabold text-blue-700">{fmtIDR(filteredTotal)}</div>
              <div className="text-xs text-emerald-700 font-semibold">Paid: {fmtIDR(filteredPaid)}</div>
              <div className="text-xs text-rose-700 font-semibold">Unpaid: {fmtIDR(filteredUnpaid)}</div>
            </div>
          </div>
          <table className="w-full text-sm mt-4" style={{fontSize: 12}}>
            <thead>
              <tr style={{background:"#F1F5F9"}}>
                <th className="text-left px-2 py-2 font-bold">Guru</th>
                <th className="text-left px-2 py-2 font-bold">No</th>
                <th className="text-left px-2 py-2 font-bold">Siswa</th>
                <th className="text-left px-2 py-2 font-bold">Program</th>
                <th className="text-right px-2 py-2 font-bold">Pertemuan</th>
                <th className="text-right px-2 py-2 font-bold">Biaya/Bulan</th>
                <th className="text-left px-2 py-2 font-bold">Buku</th>
                <th className="text-right px-2 py-2 font-bold">Harga Buku</th>
                <th className="text-right px-2 py-2 font-bold">Total</th>
                <th className="text-left px-2 py-2 font-bold">Invoice</th>
                <th className="text-center px-2 py-2 font-bold">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => {
                const s = studentMap[a.student_id]; const t = teacherMap[a.teacher_id];
                return (
                  <tr key={a.id} style={{borderBottom:"1px solid #E2E8F0"}}>
                    <td className="px-2 py-2">{t?.nama || "-"}</td>
                    <td className="px-2 py-2">{s?.no_urut ?? "-"}</td>
                    <td className="px-2 py-2">{s?.nama || "-"}</td>
                    <td className="px-2 py-2">{s ? `${s.kelas} · ${s.program_bimbel}` : "-"}</td>
                    <td className="px-2 py-2 text-right font-mono">{a.pertemuan}</td>
                    <td className="px-2 py-2 text-right font-mono">{fmtIDR(a.biaya)}</td>
                    <td className="px-2 py-2">{a.buku || "-"}</td>
                    <td className="px-2 py-2 text-right font-mono">{a.harga_buku ? fmtIDR(a.harga_buku) : "-"}</td>
                    <td className="px-2 py-2 text-right font-mono font-bold">{fmtIDR(calcTotal(a))}</td>
                    <td className="px-2 py-2 font-mono" style={{fontSize:10}}>{a.no_invoice}</td>
                    <td className="px-2 py-2 text-center font-bold" style={{color: a.payment_status === "Paid" ? "#047857" : "#BE123C"}}>{a.payment_status}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{background:"#F8FAFC"}}>
                <td colSpan={8} className="px-2 py-2 text-right font-bold">GRAND TOTAL (PAID + UNPAID)</td>
                <td className="px-2 py-2 text-right font-mono font-extrabold" style={{color:"#1D4ED8"}}>{fmtIDR(filteredTotal)}</td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-white max-w-2xl">
          <DialogHeader><DialogTitle>{editing ? "Edit Alokasi" : "Tambah Alokasi"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Label>Nama Guru</Label>
              <Select value={form.teacher_id} onValueChange={(v)=>setForm({...form, teacher_id:v})}>
                <SelectTrigger data-testid="alloc-form-teacher"><SelectValue placeholder="Pilih guru"/></SelectTrigger>
                <SelectContent>{teachers.map(t=><SelectItem key={t.id} value={t.id}>{t.nama}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label>Nama Siswa</Label>
              <Select value={form.student_id} onValueChange={onSelectStudent}>
                <SelectTrigger data-testid="alloc-form-student"><SelectValue placeholder="Pilih siswa"/></SelectTrigger>
                <SelectContent>{students.map(s=><SelectItem key={s.id} value={s.id}>{s.no_urut}. {s.nama} — {s.kelas}</SelectItem>)}</SelectContent>
              </Select>
              {form.student_id && studentMap[form.student_id] && (
                <p className="text-xs text-slate-500 mt-1">
                  Kelas: {studentMap[form.student_id].kelas} · {studentMap[form.student_id].program_kelas} · {studentMap[form.student_id].program_bimbel}
                </p>
              )}
            </div>
            <div><Label>Pertemuan (info)</Label><Input data-testid="alloc-form-pertemuan" type="number" value={form.pertemuan} onChange={(e)=>setForm({...form, pertemuan:e.target.value})}/></div>
            <div><Label>Biaya per Bulan (Rp)</Label><Input data-testid="alloc-form-biaya" type="number" value={form.biaya} onChange={(e)=>setForm({...form, biaya:e.target.value})}/></div>
            <div>
              <Label className="flex items-center gap-1"><BookOpen className="h-3.5 w-3.5"/> Buku (Nama)</Label>
              <Input data-testid="alloc-form-buku" value={form.buku} onChange={(e)=>setForm({...form, buku:capWords(e.target.value)})} placeholder="cth: Matematika SD 5"/>
            </div>
            <div><Label>Harga Buku (Rp)</Label><Input data-testid="alloc-form-harga-buku" type="number" value={form.harga_buku} onChange={(e)=>setForm({...form, harga_buku:e.target.value})}/></div>
            <div><Label>No Invoice</Label><Input data-testid="alloc-form-invoice" placeholder="Kosongkan → auto: {Nama}-INV-AELC-{Bulan}-{No} (+ -2, -3 jika sudah ada)" value={form.no_invoice} onChange={(e)=>setForm({...form, no_invoice:e.target.value})}/></div>
            <div>
              <Label>Pembayaran</Label>
              <Select value={form.payment_status} onValueChange={(v)=>setForm({...form, payment_status:v})}>
                <SelectTrigger data-testid="alloc-form-payment"><SelectValue/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Paid">Paid</SelectItem>
                  <SelectItem value="Unpaid">Unpaid</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-sm">
              <span className="text-slate-600">Total: </span>
              <span data-testid="alloc-form-total" className="font-mono font-extrabold text-blue-700">
                {fmtIDR((Number(form.biaya)||0) + (Number(form.harga_buku)||0))}
              </span>
              <span className="text-xs text-slate-500 ml-2">= Biaya per Bulan + Harga Buku</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={()=>setOpen(false)}>Batal</Button>
            <Button data-testid="alloc-form-save" onClick={save} className="bg-blue-600 hover:bg-blue-700 text-white">Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={reminderOpen} onOpenChange={setReminderOpen}>
        <DialogContent className="bg-white max-w-2xl">
          <DialogHeader>
            <DialogTitle>Kirim Reminder WhatsApp — Semua Unpaid</DialogTitle>
          </DialogHeader>
          <div className="text-sm text-slate-600">
            Ada <span className="font-bold text-slate-900">{unpaidList.length}</span> tagihan yang belum dibayar & memiliki nomor WA.
          </div>
          <div className="max-h-96 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
            {unpaidList.length === 0 && <div className="p-6 text-center text-slate-400 text-sm">Tidak ada tagihan unpaid.</div>}
            {unpaidList.map(({ alloc, student }) => (
              <div key={alloc.id} className="p-3 flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-slate-900 text-sm truncate">{student.nama}</div>
                  <div className="text-xs text-slate-500 truncate">{alloc.no_invoice} · {fmtIDR(calcTotal(alloc))} · {student.no_hp}</div>
                </div>
                <a data-testid={`send-wa-${alloc.id}`} href={buildWaLink(student, alloc)} target="_blank" rel="noopener noreferrer"
                   className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700"
                   style={{transitionProperty:"background-color",transitionDuration:"150ms"}}>
                  <Send className="h-3.5 w-3.5"/> Kirim WA
                </a>
              </div>
            ))}
          </div>
          {unpaidList.length > 0 && (
            <DialogFooter>
              <Button data-testid="open-all-wa-btn" onClick={() => {
                unpaidList.forEach(({ alloc, student }, i) => {
                  setTimeout(() => window.open(buildWaLink(student, alloc), "_blank"), i * 400);
                });
                toast.success(`Membuka ${unpaidList.length} tab WhatsApp...`);
              }} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                <Send className="h-4 w-4 mr-2"/> Buka Semua ({unpaidList.length})
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
