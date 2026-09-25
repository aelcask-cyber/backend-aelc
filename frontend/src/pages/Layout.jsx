import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { GraduationCap, LayoutDashboard, Users, UserCog, LinkIcon, CalendarDays, FileText, LogOut, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";

const NAV = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard", testid: "nav-dashboard", end: true },
  { to: "/siswa", icon: Users, label: "Data Siswa", testid: "nav-students" },
  { to: "/guru", icon: UserCog, label: "Data Guru", testid: "nav-teachers" },
  { to: "/alokasi", icon: LinkIcon, label: "Siswa per Guru", testid: "nav-allocations" },
  { to: "/jadwal", icon: CalendarDays, label: "Jadwal Siswa", testid: "nav-schedules" },
  { to: "/invoice", icon: FileText, label: "Invoice", testid: "nav-invoices" },
  { to: "/pengaturan", icon: Settings, label: "Pengaturan", testid: "nav-settings" },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();

  const handleLogout = async () => { await logout(); nav("/login"); };

  return (
    <div className="min-h-screen flex bg-slate-50">
      <aside className="w-64 shrink-0 bg-white border-r border-slate-200 flex flex-col sticky top-0 h-screen">
        <div className="h-16 flex items-center gap-2.5 px-5 border-b border-slate-200">
          <div className="h-9 w-9 rounded-lg bg-blue-600 flex items-center justify-center shadow-sm">
            <GraduationCap className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="font-extrabold text-slate-900 leading-tight">Bimbel AELC</div>
            <div className="text-[10px] text-slate-500 leading-tight">Admin Console</div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} data-testid={n.testid}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium ${
                  isActive
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`
              }
              style={{ transitionProperty: "background-color, color", transitionDuration: "150ms" }}
            >
              <n.icon className="h-4 w-4" /> {n.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-slate-200">
          <div className="px-3 py-2 mb-2 flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 text-white font-bold flex items-center justify-center text-sm" data-testid="sidebar-user-avatar">
              {(user?.name || user?.email || "A").charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-slate-900 truncate">{user?.name || "Admin"}</div>
              <div className="text-xs text-slate-500 truncate">{user?.email}</div>
            </div>
          </div>
          <Button data-testid="logout-btn" onClick={handleLogout} variant="outline"
                  className="w-full justify-start text-slate-700 hover:bg-slate-900 hover:text-white">
            <LogOut className="h-4 w-4 mr-2" /> Keluar
          </Button>
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        <Outlet />
      </main>
    </div>
  );
}
