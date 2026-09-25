import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import * as XLSX from "xlsx";
import { DAYS, DAYS_ID } from "@/lib/format";

export const scheduleFileLabel = (teacher) =>
  `Jadwal-${(teacher?.nama || "Guru").replace(/\s+/g, "-")}-${new Date().toISOString().slice(0, 10)}`;

// Halaman PDF mengikuti tinggi konten (lebar A4 landscape 297mm) agar Senin–Sabtu utuh tanpa ruang kosong.
export async function scheduleElementToPdf(el, fileLabel) {
  const canvas = await html2canvas(el, { scale: 2, backgroundColor: "#ffffff", windowWidth: 1400 });
  const pageW = 297;
  const pageH = (canvas.height * pageW) / canvas.width;
  const pdf = new jsPDF({ orientation: pageH > pageW ? "portrait" : "landscape", unit: "mm", format: [pageW, pageH] });
  pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, pageW, pageH);
  pdf.save(`${fileLabel}.pdf`);
}

export function scheduleToExcel({ teacher, times, getCell, studentMap }) {
  const header = ["Waktu", ...DAYS.map(d => DAYS_ID[d])];
  const rows = times.map(time => [
    time,
    ...DAYS.map(day => getCell(day, time).map(s => {
      const st = studentMap[s.student_id];
      return st ? `${st.nama}${st.kelas ? ` (${st.kelas})` : ""}` : "Siswa terhapus";
    }).join("\n")),
  ]);
  const ws = XLSX.utils.aoa_to_sheet([[`Jadwal Mingguan — ${teacher?.nama || ""}`], [], header, ...rows]);
  ws["!cols"] = [{ wch: 14 }, ...DAYS.map(() => ({ wch: 30 }))];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Jadwal");
  XLSX.writeFile(wb, `${scheduleFileLabel(teacher)}.xlsx`);
}
