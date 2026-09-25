import { DAYS, DAYS_ID, shortName } from "@/lib/format";

// Layout khusus cetak: lebar tetap, tanpa tombol/scroll agar html2canvas menangkap Senin–Sabtu utuh.
export function SchedulePrintSheet({ teacher, times, getCell, studentMap, isAvailable, innerRef }) {
  const cellStyle = { border: "1px solid #CBD5E1", padding: "6px 8px", verticalAlign: "top", fontSize: 12 };
  return (
    <div ref={innerRef} data-testid="schedule-print-sheet" style={{ width: 1400, background: "#fff", color: "#0F172A", padding: 32, fontFamily: "inherit" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", borderBottom: "3px solid #2563EB", paddingBottom: 12, marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 26, fontWeight: 800 }}>Jadwal Mingguan — {teacher?.nama}</div>
          <div style={{ fontSize: 13, color: "#64748B", marginTop: 4 }}>
            {teacher?.mata_pelajaran ? `${teacher.mata_pelajaran} · ` : ""}Senin – Sabtu · Bimbel AELC
          </div>
        </div>
        <div style={{ fontSize: 12, color: "#64748B" }}>Dicetak: {new Date().toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" })}</div>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
        <thead>
          <tr style={{ background: "#F1F5F9" }}>
            <th style={{ ...cellStyle, width: 120, textAlign: "left", fontWeight: 700 }}>Waktu</th>
            {DAYS.map(d => <th key={d} style={{ ...cellStyle, textAlign: "left", fontWeight: 700 }}>{DAYS_ID[d]}</th>)}
          </tr>
        </thead>
        <tbody>
          {times.map(time => (
            <tr key={time}>
              <td style={{ ...cellStyle, fontFamily: "monospace", fontWeight: 700, background: "#F8FAFC", whiteSpace: "nowrap" }}>{time}</td>
              {DAYS.map(day => {
                const items = getCell(day, time);
                const available = isAvailable(day, time);
                return (
                  <td key={day} style={{ ...cellStyle, background: available ? "#fff" : "#F8FAFC" }}>
                    {items.length === 0 && !available && <div style={{ color: "#CBD5E1", textAlign: "center" }}>—</div>}
                    {items.map(s => {
                      const st = studentMap[s.student_id];
                      return (
                        <div key={s.id} style={{ background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 6, padding: "6px 8px", marginBottom: 4, lineHeight: 1.5 }}>
                          <div style={{ fontWeight: 700, color: "#1E3A8A", wordBreak: "break-word" }}>
                            {st ? shortName(st.nama) : "Siswa terhapus"}
                          </div>
                          {st?.kelas && <div style={{ fontSize: 11, color: "#1D4ED8", lineHeight: 1.5 }}>{st.kelas}</div>}
                        </div>
                      );
                    })}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
