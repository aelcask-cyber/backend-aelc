import { fmtIDR, fmtDate } from "@/lib/format";
import { calcTotal } from "@/lib/allocations";

export function AllocationReport({ innerRef, rows, studentMap, teacherMap, scopeLabel, totals }) {
  return (
    <div style={{ position: "fixed", left: -99999, top: 0, width: 1400, background: "#fff" }}>
      <div ref={innerRef} className="p-8 bg-white" style={{ width: 1400, color: "#0F172A" }}>
        <div className="flex justify-between items-start pb-4 border-b-2 border-blue-600">
          <div>
            <div className="text-2xl font-extrabold text-slate-900">Laporan Pendapatan — Bimbel AELC</div>
            <div className="text-sm text-slate-600">{scopeLabel} · Dicetak {fmtDate(new Date().toISOString())}</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-500">Grand Total (Paid + Unpaid)</div>
            <div className="text-2xl font-extrabold text-blue-700">{fmtIDR(totals.total)}</div>
            <div className="text-xs text-emerald-700 font-semibold">Paid: {fmtIDR(totals.paid)}</div>
            <div className="text-xs text-rose-700 font-semibold">Unpaid: {fmtIDR(totals.unpaid)}</div>
          </div>
        </div>
        <table className="w-full text-sm mt-4" style={{ fontSize: 12 }}>
          <thead>
            <tr style={{ background: "#F1F5F9" }}>
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
            {rows.map((a) => {
              const s = studentMap[a.student_id]; const t = teacherMap[a.teacher_id];
              return (
                <tr key={a.id} style={{ borderBottom: "1px solid #E2E8F0" }}>
                  <td className="px-2 py-2">{t?.nama || "-"}</td>
                  <td className="px-2 py-2">{s?.no_urut ?? "-"}</td>
                  <td className="px-2 py-2">{s?.nama || "-"}</td>
                  <td className="px-2 py-2">{s ? `${s.kelas} · ${s.program_bimbel}` : "-"}</td>
                  <td className="px-2 py-2 text-right font-mono">{a.pertemuan}</td>
                  <td className="px-2 py-2 text-right font-mono">{fmtIDR(a.biaya)}</td>
                  <td className="px-2 py-2">{a.buku || "-"}</td>
                  <td className="px-2 py-2 text-right font-mono">{a.harga_buku ? fmtIDR(a.harga_buku) : "-"}</td>
                  <td className="px-2 py-2 text-right font-mono font-bold">{fmtIDR(calcTotal(a))}</td>
                  <td className="px-2 py-2 font-mono" style={{ fontSize: 10 }}>{a.no_invoice}</td>
                  <td className="px-2 py-2 text-center font-bold" style={{ color: a.payment_status === "Paid" ? "#047857" : "#BE123C" }}>{a.payment_status}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ background: "#F8FAFC" }}>
              <td colSpan={8} className="px-2 py-2 text-right font-bold">GRAND TOTAL PAID</td>
              <td className="px-2 py-2 text-right font-mono font-extrabold" style={{ color: "#047857" }}>{fmtIDR(totals.paid)}</td>
              <td colSpan={2}></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
