export const fmtIDR = (v) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(v || 0);

export const fmtDate = (iso) => {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "long", year: "numeric" }).format(d);
};

export const PROGRAM_KELAS = ["Junior Regular", "Junior Intensive", "Super Child Regular", "Super Child Intensive"];
export const PROGRAM_BIMBEL = ["Bimbel Global", "Bimbel National", "Les Mandarin", "Les Jari Math Matematika"];
export const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const DAYS_ID = { Monday: "Senin", Tuesday: "Selasa", Wednesday: "Rabu", Thursday: "Kamis", Friday: "Jumat", Saturday: "Sabtu" };
export const TIME_SLOTS = [
  "10.00 - 11.00",
  "11.00 - 12.00",
  "12.00 - 13.00",
  "13.00 - 14.00",
  "14.00 - 15.00",
  "15.00 - 16.00",
  "16.00 - 17.00",
];

// Slot per hari disimpan sebagai "Monday|10.00 - 11.00". Slot lama tanpa hari (mis. "10.00 - 11.00") berlaku untuk semua hari.
export const slotKey = (day, time) => `${day}|${time}`;
export const parseSlot = (key) => {
  const [a, b] = String(key).split("|");
  return b ? { day: a, time: b } : { day: null, time: a };
};
export const slotLabel = (key) => {
  const { day, time } = parseSlot(key);
  return `${day ? DAYS_ID[day] : "Semua hari"} - ${time.replace(/\s/g, "")}`;
};
export const sortSlots = (slots) =>
  [...slots].sort((a, b) => {
    const pa = parseSlot(a), pb = parseSlot(b);
    const da = pa.day ? DAYS.indexOf(pa.day) : -1, db = pb.day ? DAYS.indexOf(pb.day) : -1;
    return da - db || TIME_SLOTS.indexOf(pa.time) - TIME_SLOTS.indexOf(pb.time);
  });
export const teacherHasSlot = (slots, day, time) =>
  (slots || []).some((s) => { const p = parseSlot(s); return p.time === time && (!p.day || p.day === day); });
export const teacherTimes = (slots) =>
  TIME_SLOTS.filter((t) => (slots || []).some((s) => parseSlot(s).time === t));

// Huruf awal setiap kata menjadi kapital, sisa huruf dibiarkan seperti diketik.
export const capWords = (s) => String(s || "").replace(/(^|[\s\-/(])(\p{L})/gu, (m, pre, ch) => pre + ch.toUpperCase());

// Nama ≥3 kata → ambil 2 kata pertama; ≤2 kata tampil utuh.
export const shortName = (nama) => {
  const w = String(nama || "").trim().split(/\s+/).filter(Boolean);
  return w.length >= 3 ? `${w[0]} ${w[1]}` : w.join(" ");
};
