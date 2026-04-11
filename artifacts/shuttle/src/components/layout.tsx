import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useGetNotifications } from "@workspace/api-client-react";
import { 
  LayoutDashboard, CalendarPlus, History, Map, 
  BookOpen, Truck, Bell, LogOut, 
  ChevronRight, Menu, X, UsersRound, MapPin, CalendarClock
} from "lucide-react";

import { useState } from "react";

function FortyTwoIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="42">
      <text
        x="50%"
        y="50%"
        dominantBaseline="central"
        textAnchor="middle"
        fill="white"
        fontFamily="Inter, ui-sans-serif, system-ui, sans-serif"
        fontWeight="800"
        fontSize="11"
        letterSpacing="-0.5"
      >42</text>
    </svg>
  );
}

const NAV_LINKS = {
  student: [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/book", label: "Book a Ride", icon: CalendarPlus },
    { href: "/history", label: "My Bookings", icon: History },
    { href: "/map", label: "Route Map", icon: Map },
  ],
  admin: [
    { href: "/admin", label: "Overview", icon: LayoutDashboard },
    { href: "/admin/bookings", label: "All Bookings", icon: BookOpen },
    { href: "/admin/drivers", label: "Driver Management", icon: UsersRound },
    { href: "/admin/terminals", label: "Pickup Terminals", icon: MapPin },
    { href: "/admin/schedule", label: "Schedule Manager", icon: CalendarClock },
  ],
  driver: [
    { href: "/driver", label: "My Trips", icon: Truck },
    { href: "/map", label: "Route Map", icon: Map },
  ],
};

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const { data: notifications } = useGetNotifications({
    query: { enabled: !!user }
  });
  const unreadCount = notifications?.filter(n => !n.isRead).length || 0;

  const handleLogout = () => {
    logout();
    setLocation("/");
  };

  if (!user) return <>{children}</>;

  const links = NAV_LINKS[user.role as keyof typeof NAV_LINKS] || [];

  const roleColor = {
    student: "text-[#22d3ee]",
    admin: "text-[#ff2e88]",
    driver: "text-emerald-400",
  }[user.role] || "text-white";

  const roleBg = {
    student: "bg-[#22d3ee]/10 border-[#22d3ee]/30",
    admin: "bg-[#ff2e88]/10 border-[#ff2e88]/30",
    driver: "bg-emerald-400/10 border-emerald-400/30",
  }[user.role] || "bg-white/5 border-white/10";

  return (
    <div className="min-h-screen flex flex-col md:flex-row w-full bg-[#0a0e17]">
      {/* Mobile top bar */}
      <header className="md:hidden flex items-center justify-between px-4 h-14 border-b border-white/[0.06] bg-[#090d14] z-30 relative">
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-2 rounded-lg hover:bg-white/[0.05] transition-colors"
        >
          <Menu size={20} className="text-white/70" />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-gradient-to-br from-[#ff2e88] to-[#7c3aed] flex items-center justify-center">
            <FortyTwoIcon size={14} />
          </div>
          <span className="font-semibold text-sm text-white">42 transportation</span>
        </div>
        <Link href="/notifications" className="relative p-2 rounded-lg hover:bg-white/[0.05] transition-colors">
          <Bell size={20} className="text-white/70" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 w-4 h-4 bg-[#ff2e88] rounded-full text-[10px] flex items-center justify-center text-white font-bold pulse-pink">
              {unreadCount}
            </span>
          )}
        </Link>
      </header>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-[999] w-64 flex flex-col
        bg-[#090d14] border-r border-white/[0.06]
        transform transition-transform duration-300 ease-in-out
        md:relative md:translate-x-0 md:flex md:z-[999]
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
      `}>
        {/* Logo */}
        <div className="flex items-center justify-between px-5 h-16 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#ff2e88] to-[#7c3aed] flex items-center justify-center shadow-lg glow-pink">
              <FortyTwoIcon size={16} />
            </div>
            <div>
              <div className="text-sm font-bold text-white leading-none">42 transportation</div>
              <div className="text-[10px] text-[#a7b0c0] mt-0.5">42 Irbid</div>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="md:hidden p-1.5 rounded-lg hover:bg-white/[0.05] transition-colors"
          >
            <X size={16} className="text-white/50" />
          </button>
        </div>

        {/* User card */}
        <div className="px-4 py-4 border-b border-white/[0.06]">
          <div className={`rounded-xl border p-3 ${roleBg}`}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#ff2e88]/20 to-[#22d3ee]/20 border border-white/10 flex items-center justify-center shrink-0">
                <span className="text-sm font-bold text-white">{user.name.charAt(0).toUpperCase()}</span>
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-white truncate">{user.name}</div>
                <div className={`text-xs font-medium capitalize ${roleColor}`}>{user.role}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {links.map(({ href, label, icon: Icon }) => {
            const active = href === "/admin"
              ? location === href
              : location === href || (href !== "/" && location.startsWith(`${href}/`));
            return (
              <Link key={href} href={href} onClick={() => setSidebarOpen(false)}>
                <div className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer
                  transition-all duration-150 group
                  ${active
                    ? "bg-[#ff2e88]/15 text-[#ff2e88] border border-[#ff2e88]/20"
                    : "text-[#a7b0c0] hover:bg-white/[0.05] hover:text-white border border-transparent"
                  }
                `}>
                  <Icon size={17} className={active ? "text-[#ff2e88]" : "text-[#a7b0c0] group-hover:text-white"} />
                  <span className="text-sm font-medium">{label}</span>
                  {active && <ChevronRight size={14} className="ml-auto text-[#ff2e88]/60" />}
                </div>
              </Link>
            );
          })}
        </nav>

        {/* Bottom actions */}
        <div className="px-3 py-4 border-t border-white/[0.06] space-y-1">
          <Link href="/notifications" onClick={() => setSidebarOpen(false)}>
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[#a7b0c0] hover:bg-white/[0.05] hover:text-white transition-all cursor-pointer">
              <Bell size={17} />
              <span className="text-sm font-medium">Notifications</span>
              {unreadCount > 0 && (
                <span className="ml-auto bg-[#ff2e88] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {unreadCount}
                </span>
              )}
            </div>
          </Link>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[#a7b0c0] hover:bg-red-500/10 hover:text-red-400 transition-all"
          >
            <LogOut size={17} />
            <span className="text-sm font-medium">Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto min-h-0 md:min-h-screen">
        <div className="max-w-7xl mx-auto px-4 py-6 md:px-6 md:py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
