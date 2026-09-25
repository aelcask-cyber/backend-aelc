import { fmtIDR } from "@/lib/format";
import { calcTotal } from "@/lib/allocations";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2 } from "lucide-react";

const ALIGN = { left: "text-left", right: "text-right", center: "text-center" };
const HEADERS = [
  ["Guru", "left"], ["No", "left"], ["Siswa", "left"], ["Kelas / Program", "left"], ["Pertemuan", "right"],
  ["Biaya/Bulan", "right"], ["Buku", "left"], ["Harga Buku", "right"], ["Total", "right"], ["No Invoice", "left"],
  ["Pembayaran", "center"], ["Aksi", "right"],
];

export function AllocationTable({ rows, studentMap, teacherMap, onEdit, onDelete, onTogglePaid }) {
  return (
    <div className="overflow-x-auto" style={{ scrollbarGutter: "stable" }}>
      <table className="w-full text-sm min-w-[1200px]">
        <thead className="bg-slate-50 text-slate-600">
          <tr>{HEADERS.map(([h, align]) => <th key={h} className={`${ALIGN[align]} px-4 py-3 font-semibold`}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={12} className="px-4 py-10 text-center text-slate-400">Belum ada alokasi.</td></tr>}
          {rows.map((a) => {
            const s = studentMap[a.student_id];
            const t = teacherMap[a.teacher_id];
            const paid = a.payment_status === "Paid";
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
                <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">{fmtIDR(calcTotal(a))}</td>
                <td className="px-4 py-3 font-mono text-xs text-slate-700">{a.no_invoice}</td>
                <td className="px-4 py-3 text-center">
                  <button data-testid={`toggle-payment-${a.id}`} onClick={() => onTogglePaid(a)}
                    className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${
                      paid ? "bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-200"
                           : "bg-rose-100 text-rose-800 border-rose-200 hover:bg-rose-200"}`}
                    style={{ transitionProperty: "background-color", transitionDuration: "150ms" }}>
                    {a.payment_status}
                  </button>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <Button data-testid={`edit-allocation-${a.id}`} size="icon" variant="ghost" onClick={() => onEdit(a)}><Pencil className="h-4 w-4"/></Button>
                    <Button data-testid={`delete-allocation-${a.id}`} size="icon" variant="ghost" onClick={() => onDelete(a)} className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"><Trash2 className="h-4 w-4"/></Button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
