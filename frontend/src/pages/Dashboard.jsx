import { useEffect, useState } from "react";
import api from "@/lib/api";
import { fmtIDR } from "@/lib/format";
import { Users, GraduationCap, AlertTriangle, TrendingUp, Wallet } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from "recharts";

const StatCard = ({ icon: Icon, label, value, tone, testid }) => (
  <div data-testid={testid} className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs hover:shadow-md"
       style={{ transitionProperty: "box-shadow, transform", transitionDuration: "200ms" }}>
    <div className="flex items-start justify-between">
      <div>
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</div>
        <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-2 tracking-tight">{value}</div>
      </div>
      <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${tone}`}>
        <Icon className="h-5 w-5" />
      </div>
    </div>
  </div>
);

const MONTHS_ID = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];
const shortMonth = (ym) => {
  const [y, m] = ym.split("-").map(Number);
  return `${MONTHS_ID[m-1]} ${String(y).slice(2)}`;
};
const compact = (v) => {
  if (v >= 1_000_000) return `Rp${(v/1_000_000).toFixed(1)}jt`;
  if (v >= 1_000) return `Rp${(v/1_000).toFixed(0)}rb`;
  return `Rp${v}`;
};

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [monthly, setMonthly] = useState([]);

  useEffect(() => {
    api.get("/dashboard/stats").then((r) => setStats(r.data));
    api.get("/dashboard/revenue-monthly").then((r) =>
      setMonthly(r.data.map(d => ({ ...d, label: shortMonth(d.month) })))
    );
  }, []);

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500 mt-1">Ringkasan operasional Bimbel AELC hari ini.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        <StatCard testid="stat-total-siswa" icon={Users} label="Total Siswa" value={stats?.total_siswa ?? "—"} tone="bg-blue-100 text-blue-700" />
        <StatCard testid="stat-total-guru" icon={GraduationCap} label="Total Guru" value={stats?.total_guru ?? "—"} tone="bg-indigo-100 text-indigo-700" />
        <StatCard testid="stat-unpaid-count" icon={AlertTriangle} label="Invoice Unpaid" value={stats?.total_unpaid ?? "—"} tone="bg-orange-100 text-orange-700" />
        <StatCard testid="stat-pendapatan" icon={TrendingUp} label="Total Pendapatan (Paid)" value={stats ? fmtIDR(stats.pendapatan) : "—"} tone="bg-amber-100 text-amber-700" />
        <StatCard testid="stat-outstanding" icon={Wallet} label="Outstanding (Unpaid)" value={stats ? fmtIDR(stats.outstanding) : "—"} tone="bg-rose-100 text-rose-700" />
      </div>

      <div data-testid="revenue-chart" className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Rekap Pendapatan 6 Bulan Terakhir</h2>
            <p className="text-xs text-slate-500 mt-0.5">Berdasarkan tanggal alokasi invoice.</p>
          </div>
          <div className="flex gap-3 text-xs">
            <div className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-500"/> Paid</div>
            <div className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-rose-400"/> Unpaid</div>
          </div>
        </div>
        <div className="w-full h-72">
          <ResponsiveContainer>
            <BarChart data={monthly} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false}/>
              <XAxis dataKey="label" stroke="#64748B" fontSize={12} tickLine={false} axisLine={false}/>
              <YAxis stroke="#64748B" fontSize={12} tickFormatter={compact} tickLine={false} axisLine={false}/>
              <Tooltip
                cursor={{ fill: "rgba(59,130,246,0.06)" }}
                contentStyle={{ borderRadius: 8, border: "1px solid #E2E8F0", background: "#fff" }}
                formatter={(v) => fmtIDR(v)}
              />
              <Legend wrapperStyle={{ display: "none" }}/>
              <Bar dataKey="paid" name="Paid" fill="#10B981" radius={[6,6,0,0]} maxBarSize={44}/>
              <Bar dataKey="unpaid" name="Unpaid" fill="#FB7185" radius={[6,6,0,0]} maxBarSize={44}/>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-slate-900">Selamat Datang di Bimbel AELC 👋</h2>
        <p className="text-sm text-slate-600 mt-2 max-w-2xl">
          Gunakan menu di kiri untuk mengelola data siswa, guru, alokasi pengajaran, jadwal mingguan, dan pembuatan invoice.
          Semua data terhubung otomatis — setiap perubahan pada Master Data Siswa akan memperbarui pilihan di modul lainnya.
        </p>
      </div>
    </div>
  );
}
