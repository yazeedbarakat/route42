import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useGetNotifications } from "@workspace/api-client-react";
import { Bell, LogOut, Menu, X } from "lucide-react";
import { useState } from "react";

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const { data: notifications } = useGetNotifications({
    query: { enabled: !!user }
  });

  const unreadCount = notifications?.filter(n => !n.isRead).length || 0;

  const handleLogout = () => {
    logout();
    setLocation("/");
  };

  const getLinks = () => {
    if (!user) return [];
    if (user.role === "student") {
      return [
        { href: "/dashboard", label: "DASHBOARD" },
        { href: "/book", label: "BOOK_RIDE" },
        { href: "/history", label: "HISTORY" },
        { href: "/map", label: "ROUTE_MAP" },
      ];
    } else if (user.role === "admin") {
      return [
        { href: "/admin", label: "ADMIN_PANEL" },
        { href: "/admin/bookings", label: "ALL_BOOKINGS" },
      ];
    } else if (user.role === "driver") {
      return [
        { href: "/driver", label: "TRIPS_TODAY" },
      ];
    }
    return [];
  };

  if (!user) return <>{children}</>;

  return (
    <div className="min-h-screen flex flex-col md:flex-row w-full">
      {/* Mobile Header */}
      <header className="md:hidden flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 border border-border">
            {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <span className="font-bold">{">"} SSS_SYS</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/notifications" className="relative cursor-pointer">
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground text-xs px-1">
                {unreadCount}
              </span>
            )}
          </Link>
        </div>
      </header>

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 border-r border-border bg-background transform transition-transform duration-200 ease-in-out md:relative md:translate-x-0
        ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"}
      `}>
        <div className="flex flex-col h-full p-4">
          <div className="mb-8 hidden md:block">
            <div className="text-xl font-bold mb-2">┌─────────────┐</div>
            <div className="text-xl font-bold px-2">│ SSS_SYS_V1  │</div>
            <div className="text-xl font-bold mb-4">└─────────────┘</div>
          </div>
          
          <div className="mb-8 border border-border p-3">
            <div className="text-xs text-muted-foreground mb-1">CURRENT_USER:</div>
            <div className="font-bold truncate">{user.name}</div>
            <div className="text-xs text-primary mt-1">ROLE: {user.role.toUpperCase()}</div>
          </div>

          <nav className="flex-1 flex flex-col gap-2">
            {getLinks().map(link => (
              <Link key={link.href} href={link.href} onClick={() => setIsSidebarOpen(false)}>
                <div className={`p-2 border border-transparent hover:border-border cursor-pointer transition-colors ${location === link.href ? "bg-primary text-primary-foreground font-bold" : ""}`}>
                  {location === link.href ? ">> " : "  "}{link.label}
                </div>
              </Link>
            ))}
          </nav>

          <div className="mt-auto flex flex-col gap-4">
            <Link href="/notifications" className="p-2 border border-border flex items-center justify-between hover:bg-primary hover:text-primary-foreground cursor-pointer transition-colors" onClick={() => setIsSidebarOpen(false)}>
              <span>NOTIFICATIONS</span>
              {unreadCount > 0 && <span className="bg-destructive text-destructive-foreground px-2">{unreadCount}</span>}
            </Link>
            <button onClick={handleLogout} className="flex items-center gap-2 p-2 border border-border hover:bg-destructive hover:text-destructive-foreground transition-colors w-full text-left">
              <LogOut size={16} /> LOGOUT
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8 max-h-screen overflow-y-auto">
        {children}
      </main>

      {/* Overlay for mobile sidebar */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
    </div>
  );
}
