import { useEffect, useMemo, useRef, useState } from "react";
import api, { formatApiError } from "@/lib/api";
import { fmtIDR, fmtDate, capWords } from "@/lib/format";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GraduationCap, Download, MessageCircle, FileText, FolderDown } from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import JSZip from "jszip";
import { useLogo } from "@/lib/logo";
import { useCompany, BANK_OPTIONS } from "@/lib/company";

const calcTotal = (a) => (Number(a?.biaya) || 0) + (Number(a?.harga_buku) || 0);

function BankChip({ bank_name }) {
  const b = BANK_OPTIONS.find(x => x.code === bank_name) || BANK_OPTIONS[0];
  return (
    <div className="inline-flex items-center px-3 py-1.5 rounded font-extrabold text-white text-lg" style={{backgroundColor: b.color}}>
      {b.name}
    </div>
  );
}

export default function Invoices() {
  const [allocs, setAllocs] = useState([]);
  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [savingAll, setSavingAll] = useState(false);
  const invoiceRef = useRef(null);
  const logo = useLogo();
  const company = useCompany();

  useEffect(() => {
    Promise.all([api.get("/allocations"), api.get("/students"), api.get("/teachers")])
      .then(([a, s, t]) => { setAllocs(a.data); setStudents(s.data); setTeachers(t.data); })
      .catch(e => toast.error(formatApiError(e)));
  }, []);

  const studentMap = useMemo(() => Object.fromEntries(students.map(s => [s.id, s])), [students]);
  const teacherMap = useMemo(() => Object.fromEntries(teachers.map(t => [t.id, t])), [teachers]);

  const alloc = allocs.find(a => a.id === selectedId);
  const student = alloc ? studentMap[alloc.student_id] : null;
  const teacher = alloc ? teacherMap[alloc.teacher_id] : null;
  const totalBiaya = alloc ? Number(alloc.biaya || 0) : 0;
  const totalBuku = alloc ? Number(alloc.harga_buku || 0) : 0;
  const grandTotal = totalBiaya + totalBuku;
  const invoiceDate = new Date().toISOString();

  const generatePdfBlob = async (targetEl) => {
    const canvas = await html2canvas(targetEl, { scale: 2, backgroundColor: "#ffffff" });
    const imgData = canvas.toDataURL("image/png");
    // Ukuran halaman PDF mengikuti rasio area invoice (lebar A4 210mm) — tanpa sisa ruang kosong
    const pageW = 210;
    const pageH = (canvas.height * pageW) / canvas.width;
    const pdf = new jsPDF({ orientation: pageH > pageW ? "portrait" : "landscape", unit: "mm", format: [pageW, pageH] });
    pdf.addImage(imgData, "PNG", 0, 0, pageW, pageH);
    return pdf.output("blob");
  };

  const downloadPDF = async () => {
    if (!invoiceRef.current) return;
    toast.loading("Membuat PDF...", { id: "pdf" });
    try {
      const blob = await generatePdfBlob(invoiceRef.current);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `${alloc.no_invoice || "invoice"}.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      toast.success("PDF berhasil diunduh", { id: "pdf" });
    } catch (e) { toast.error("Gagal membuat PDF", { id: "pdf" }); }
  };

  const [renderBatch, setRenderBatch] = useState(null); // {alloc}
  const batchRef = useRef(null);

  const saveAll = async () => {
    if (allocs.length === 0) return toast.error("Belum ada invoice");
    setSavingAll(true);
    toast.loading(`Membuat ${allocs.length} invoice...`, { id: "zip" });
    try {
      const zip = new JSZip();
      const mm = new Date().toISOString().slice(5, 7);
      const folderName = `INV-AELC-${mm}`;
      const folder = zip.folder(folderName);
      for (const a of allocs) {
        setRenderBatch({ alloc: a });
        // wait render
        await new Promise(r => setTimeout(r, 300));
        if (!batchRef.current) continue;
        const blob = await generatePdfBlob(batchRef.current);
        folder.file(`${a.no_invoice || a.id}.pdf`, blob);
      }
      setRenderBatch(null);
      const zipBlob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(zipBlob);
      const link = document.createElement("a");
      link.href = url; link.download = `${folderName}.zip`;
      document.body.appendChild(link); link.click(); link.remove();
      URL.revokeObjectURL(url);
      toast.success(`ZIP ${folderName} berhasil diunduh`, { id: "zip" });
    } catch (e) {
      console.error(e);
      toast.error("Gagal membuat ZIP", { id: "zip" });
    }
    setSavingAll(false);
  };

  const sendWA = () => {
    if (!student?.no_hp) return toast.error("No HP siswa belum diisi");
    let phone = student.no_hp.replace(/\D/g, "");
    if (phone.startsWith("0")) phone = "62" + phone.slice(1);
    const msg = `Halo ${student.nama},\n\nBerikut tagihan Bimbel AELC Anda:\n\n*No Invoice*: ${alloc.no_invoice}\n*Program*: ${student.program_bimbel}\n*Guru*: ${teacher?.nama || "-"}\n*Pertemuan*: ${alloc.pertemuan}x @ ${fmtIDR(alloc.biaya)}\n${alloc.buku ? `*Buku*: ${alloc.buku} — ${fmtIDR(alloc.harga_buku)}\n` : ""}*Total*: ${fmtIDR(grandTotal)}\n*Status*: ${alloc.payment_status}\n\nSilakan lakukan pembayaran ke:\n*Bank ${company.bank_name}*\nNo Rek: ${company.bank_account_number}\na/n ${company.bank_account_holder}\n\nTerima kasih 🙏`;
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
  };

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Invoice Penagihan</h1>
        <p className="text-sm text-slate-500 mt-1">Pilih tagihan dari alokasi siswa untuk generate invoice.</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap gap-3 items-center">
        <div className="flex-1 min-w-[260px]">
          <Select value={selectedId} onValueChange={setSelectedId}>
            <SelectTrigger data-testid="invoice-select"><SelectValue placeholder="Pilih tagihan (No Invoice — Siswa)"/></SelectTrigger>
            <SelectContent>
              {allocs.map(a => {
                const s = studentMap[a.student_id];
                return <SelectItem key={a.id} value={a.id}>{a.no_invoice} — {s?.nama || "?"} · {fmtIDR(calcTotal(a))}</SelectItem>;
              })}
            </SelectContent>
          </Select>
        </div>
        <Button data-testid="invoice-save-pdf" onClick={downloadPDF} disabled={!alloc} className="bg-blue-600 hover:bg-blue-700 text-white">
          <Download className="h-4 w-4 mr-2"/> Save to PDF
        </Button>
        <Button data-testid="invoice-save-all" onClick={saveAll} disabled={savingAll || allocs.length === 0} variant="outline" className="border-blue-500 text-blue-700 hover:bg-blue-50">
          <FolderDown className="h-4 w-4 mr-2"/> Save Semua (ZIP)
        </Button>
        <Button data-testid="invoice-send-wa" onClick={sendWA} disabled={!alloc} variant="outline" className="border-emerald-500 text-emerald-700 hover:bg-emerald-50">
          <MessageCircle className="h-4 w-4 mr-2"/> Send to WhatsApp
        </Button>
      </div>

      {!alloc && (
        <div className="bg-white border border-dashed border-slate-300 rounded-xl p-12 text-center">
          <FileText className="h-12 w-12 text-slate-300 mx-auto mb-3"/>
          <p className="text-slate-500">Pilih tagihan di atas untuk melihat pratinjau invoice.</p>
        </div>
      )}

      {alloc && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-6 overflow-x-auto">
          <div ref={invoiceRef} data-testid="invoice-preview" className="invoice-print bg-white p-10 mx-auto" style={{ color: "#0F172A", width: 900 }}>
            <InvoiceBody logo={logo} company={company} alloc={alloc} student={student} teacher={teacher}
                         totalBiaya={totalBiaya} totalBuku={totalBuku} grandTotal={grandTotal} invoiceDate={invoiceDate}/>
          </div>
        </div>
      )}

      {/* Offscreen render target for batch ZIP */}
      {renderBatch && (
        <div style={{position:"fixed", left:-99999, top:0, width: 900, background:"#fff"}}>
          <div ref={batchRef} className="bg-white p-10" style={{width: 900, color:"#0F172A"}}>
            <InvoiceBody
              logo={logo} company={company}
              alloc={renderBatch.alloc}
              student={studentMap[renderBatch.alloc.student_id]}
              teacher={teacherMap[renderBatch.alloc.teacher_id]}
              totalBiaya={Number(renderBatch.alloc.biaya||0)}
              totalBuku={Number(renderBatch.alloc.harga_buku||0)}
              grandTotal={calcTotal(renderBatch.alloc)}
              invoiceDate={new Date().toISOString()}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function InvoiceBody({ logo, company, alloc, student, teacher, totalBiaya, totalBuku, grandTotal, invoiceDate }) {
  return (
    <>
      <div className="flex justify-between items-start pb-6 border-b-2 border-blue-600">
        <div className="flex items-start gap-3">
          {logo ? (
            <img src={logo} alt="Bimbel AELC" className="h-16 w-16 rounded-xl object-contain border border-slate-200 bg-white"/>
          ) : (
            <div className="h-16 w-16 rounded-xl bg-blue-600 flex items-center justify-center">
              <GraduationCap className="h-9 w-9 text-white"/>
            </div>
          )}
          <div>
            <div className="text-2xl font-extrabold text-slate-900">Bimbel AELC</div>
            <div className="text-xs text-slate-500 font-semibold">CV ARITA YASA NUSANTARA</div>
            <div className="text-xs text-slate-500 mt-1 max-w-xs leading-relaxed">{company.alamat}</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-3xl font-extrabold text-blue-600 tracking-tight">INVOICE</div>
          <div className="text-sm text-slate-600 mt-1">No. <span className="font-mono font-semibold">{alloc.no_invoice}</span></div>
          <div className="text-xs text-slate-500 mt-0.5">Tanggal: {fmtDate(invoiceDate)}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6 mt-6">
        <div data-testid="invoice-bill-to">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Bill To</div>
          <div className="text-base font-bold text-slate-900">{capWords(student?.nama)}</div>
          <div className="text-sm text-slate-600">{fmtDate(student?.tanggal_lahir)}</div>
          <div className="text-sm text-slate-600">{capWords(student?.asal_sekolah) || "-"}</div>
          <div className="text-sm text-slate-600">{student?.no_hp}</div>
        </div>
        <div className="text-right">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">No Urut Siswa</div>
          <div className="text-base font-bold text-slate-900 font-mono">
            #{String(student?.no_urut ?? 0).padStart(3, "0")}
          </div>
          <div className="text-sm mt-2">
            <span className={alloc.payment_status === "Paid"
              ? "inline-flex px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300"
              : "inline-flex px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300"}>
              {alloc.payment_status.toUpperCase()}
            </span>
          </div>
        </div>
      </div>

      <table className="w-full mt-8 text-sm">
        <thead className="bg-slate-100">
          <tr>
            <th className="text-left px-4 py-3 font-bold text-slate-700">Description</th>
            <th className="text-center px-4 py-3 font-bold text-slate-700 w-24">Meeting</th>
            <th className="text-right px-4 py-3 font-bold text-slate-700 w-40">Price</th>
            <th className="text-right px-4 py-3 font-bold text-slate-700 w-40">Total</th>
          </tr>
        </thead>
        <tbody>
          {Number(alloc.biaya) > 0 && (
            <tr className="border-b border-slate-200">
              <td className="px-4 py-4">
                <div className="font-semibold text-slate-900">{student?.program_bimbel}</div>
                <div className="text-xs text-slate-600 mt-0.5">Program: {student?.program_kelas}</div>
              </td>
              <td className="px-4 py-4 text-center font-mono text-slate-600">
                {Number(alloc.pertemuan) > 0 ? `${alloc.pertemuan}x` : "—"}
              </td>
              <td className="px-4 py-4 text-right font-mono">{fmtIDR(alloc.biaya)}</td>
              <td className="px-4 py-4 text-right font-mono font-semibold">{fmtIDR(totalBiaya)}</td>
            </tr>
          )}
          {Number(alloc.harga_buku) > 0 && (
            <tr className="border-b border-slate-200">
              <td className="px-4 py-4">
                <div className="font-semibold text-slate-900">Pembelian Buku{alloc.buku ? `: ${alloc.buku}` : ""}</div>
                <div className="text-xs text-slate-500 mt-0.5">Materi pendukung</div>
              </td>
              <td className="px-4 py-4 text-center font-mono text-slate-400">—</td>
              <td className="px-4 py-4 text-right font-mono">{fmtIDR(alloc.harga_buku)}</td>
              <td className="px-4 py-4 text-right font-mono font-semibold">{fmtIDR(totalBuku)}</td>
            </tr>
          )}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={3} className="px-4 py-3 text-right font-bold text-slate-700">Grand Total</td>
            <td className="px-4 py-3 text-right font-mono font-extrabold text-lg text-blue-700">{fmtIDR(grandTotal)}</td>
          </tr>
        </tfoot>
      </table>

      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="text-xs font-semibold uppercase tracking-wider text-blue-700 mb-2">Payment Method</div>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-4">
            <BankChip bank_name={company.bank_name}/>
            <div>
              <div className="text-lg font-extrabold text-slate-900 font-mono">{company.bank_account_number}</div>
              <div className="text-sm text-slate-700">a/n <span className="font-semibold">{company.bank_account_holder}</span></div>
            </div>
          </div>
          <div className="text-xs text-slate-500">Mohon lakukan pembayaran sebelum tanggal jatuh tempo.</div>
        </div>
      </div>

      <div className="mt-8 pt-4 border-t border-slate-200 text-center text-xs text-slate-500">
        Terima kasih atas kepercayaan Anda kepada Bimbel AELC.
      </div>
    </>
  );
}
