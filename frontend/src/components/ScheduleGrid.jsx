import { DAYS, DAYS_ID, shortName } from "@/lib/format";
import { Plus, Trash2 } from "lucide-react";

function ScheduleCard({ schedule, student, onDelete }) {
  return (
    <div data-testid={`schedule-card-${schedule.id}`} className="group bg-blue-50 border border-blue-200 rounded-lg px-2.5 py-2 text-xs">
      <div className="flex items-start justify-between gap-1">
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-blue-900 leading-snug break-words" title={student?.nama}>
            {student ? shortName(student.nama) : <span className="text-rose-600 italic">Siswa terhapus</span>}
          </div>
          <div className="text-blue-700 text-[11px]">{student?.kelas}</div>
        </div>
        <button data-testid={`delete-schedule-${schedule.id}`} onClick={() => onDelete(schedule.id)}
                className="opacity-0 group-hover:opacity-100 text-rose-600 hover:text-rose-700"
                style={{ transitionProperty: "opacity", transitionDuration: "150ms" }}>
          <Trash2 className="h-3.5 w-3.5"/>
        </button>
      </div>
    </div>
  );
}

export function ScheduleGrid({ teacher, times, getCell, studentMap, isAvailable, onAdd, onDelete }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto" style={{ scrollbarGutter: "stable" }}>
      <div className="px-6 pt-5 pb-3 border-b border-slate-200 bg-white">
        <div className="text-xl font-extrabold text-slate-900">Jadwal Mingguan — {teacher?.nama}</div>
        <div className="text-xs text-slate-500">{teacher?.mata_pelajaran ? `${teacher.mata_pelajaran} · ` : ""}Senin – Sabtu · Bimbel AELC</div>
      </div>
      <table className="w-full text-sm min-w-[1100px]">
        <thead className="bg-slate-50 text-slate-600">
          <tr>
            <th className="text-left px-4 py-3 font-semibold w-28">Waktu</th>
            {DAYS.map(d => <th key={d} className="text-left px-4 py-3 font-semibold">{DAYS_ID[d]}</th>)}
          </tr>
        </thead>
        <tbody>
          {times.map(time => (
            <tr key={time} className="border-t border-slate-100">
              <td className="px-4 py-3 font-mono text-xs text-slate-700 font-semibold bg-slate-50/50">{time}</td>
              {DAYS.map(day => {
                const items = getCell(day, time);
                const available = isAvailable(day, time);
                return (
                  <td key={day} className={`px-2 py-2 align-top border-l border-slate-100 min-w-[140px] ${available ? "" : "bg-slate-50/70"}`}>
                    <div className="space-y-1.5">
                      {items.map(s => <ScheduleCard key={s.id} schedule={s} student={studentMap[s.student_id]} onDelete={onDelete}/>)}
                      {available ? (
                        <button data-testid={`add-schedule-${day}-${time}`} onClick={() => onAdd(day, time)}
                          className="w-full flex items-center justify-center gap-1 py-1.5 rounded-md border border-dashed border-slate-300 text-slate-400 hover:border-blue-400 hover:text-blue-600 text-xs"
                          style={{ transitionProperty: "border-color,color", transitionDuration: "150ms" }}>
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
  );
}
