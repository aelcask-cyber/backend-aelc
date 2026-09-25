import { TIME_SLOTS, DAYS, DAYS_ID, slotKey, parseSlot, sortSlots } from "@/lib/format";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

const ALL_SLOTS = DAYS.flatMap(d => TIME_SLOTS.map(t => slotKey(d, t)));

function DayGroup({ day, slots, onToggle, onSetDay }) {
  const dayCount = slots.filter(s => parseSlot(s).day === day).length;
  const allDay = dayCount === TIME_SLOTS.length;
  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden" data-testid={`slot-group-${day}`}>
      <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-b border-slate-200">
        <label className="flex items-center gap-2 cursor-pointer">
          <Checkbox data-testid={`slot-day-all-${day}`} checked={allDay ? true : dayCount > 0 ? "indeterminate" : false}
                    onCheckedChange={(v) => onSetDay(day, v === true)}/>
          <span className="text-sm font-bold text-slate-800">{DAYS_ID[day]}</span>
        </label>
        <span className="text-[11px] text-slate-500">{dayCount}/{TIME_SLOTS.length} jam</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-2">
        {TIME_SLOTS.map(time => {
          const key = slotKey(day, time);
          const checked = slots.includes(key);
          return (
            <label key={key} title={`${DAYS_ID[day]} - ${time.replace(/\s/g, "")}`}
              className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm cursor-pointer border ${
                checked ? "bg-blue-50 border-blue-400 text-blue-900" : "bg-white border-slate-200 text-slate-700 hover:bg-slate-100"}`}
              style={{ transitionProperty: "background-color,border-color", transitionDuration: "150ms" }}>
              <Checkbox data-testid={`slot-${day}-${time.replace(/[^0-9]/g, "")}`} checked={checked} onCheckedChange={() => onToggle(key)}/>
              <span className="font-mono text-[11px] font-semibold">{time}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

export function TeacherSlotPicker({ slots, onChange }) {
  const toggle = (key) => onChange(sortSlots(slots.includes(key) ? slots.filter(s => s !== key) : [...slots, key]));
  const setDay = (day, on) => {
    const others = slots.filter(s => parseSlot(s).day !== day);
    onChange(sortSlots(on ? [...others, ...TIME_SLOTS.map(t => slotKey(day, t))] : others));
  };
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <Label>Jam Mengajar <span className="text-slate-400 font-normal">({slots.length} slot dipilih)</span></Label>
        <div className="flex gap-2 text-xs">
          <button data-testid="slots-select-all" type="button" onClick={() => onChange(sortSlots(ALL_SLOTS))} className="text-blue-600 hover:underline font-semibold">Pilih semua</button>
          <span className="text-slate-300">·</span>
          <button data-testid="slots-clear-all" type="button" onClick={() => onChange([])} className="text-slate-500 hover:underline">Kosongkan</button>
        </div>
      </div>
      <div className="space-y-2">
        {DAYS.map(day => <DayGroup key={day} day={day} slots={slots} onToggle={toggle} onSetDay={setDay}/>)}
      </div>
      <p className="text-xs text-slate-500 mt-1.5">Contoh: "Senin - 10.00-11.00". Jam yang dicentang akan muncul di grid Jadwal Siswa untuk guru ini pada hari tersebut.</p>
    </div>
  );
}
