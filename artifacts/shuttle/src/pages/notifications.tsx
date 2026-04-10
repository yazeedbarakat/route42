import { useGetNotifications, useMarkNotificationRead } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { format } from "date-fns";
import { Bell, CheckCheck, CheckCircle2, Bus, AlertTriangle, Info, Loader2 } from "lucide-react";

function NotifIcon({ type }: { type: string }) {
  if (type === "trip_confirmed") return (
    <div className="w-9 h-9 rounded-xl bg-emerald-400/10 border border-emerald-400/20 flex items-center justify-center shrink-0">
      <CheckCircle2 size={16} className="text-emerald-400" />
    </div>
  );
  if (type === "bus_approaching") return (
    <div className="w-9 h-9 rounded-xl bg-[#22d3ee]/10 border border-[#22d3ee]/20 flex items-center justify-center shrink-0">
      <Bus size={16} className="text-[#22d3ee]" />
    </div>
  );
  if (type === "trip_cancelled") return (
    <div className="w-9 h-9 rounded-xl bg-red-400/10 border border-red-400/20 flex items-center justify-center shrink-0">
      <AlertTriangle size={16} className="text-red-400" />
    </div>
  );
  return (
    <div className="w-9 h-9 rounded-xl bg-[#ff2e88]/10 border border-[#ff2e88]/20 flex items-center justify-center shrink-0">
      <Info size={16} className="text-[#ff2e88]" />
    </div>
  );
}

export default function Notifications() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!user) setLocation("/");
  }, [user, setLocation]);

  const { data: notifications, isLoading, refetch } = useGetNotifications();
  const markRead = useMarkNotificationRead();

  const handleMarkRead = async (id: number) => {
    try {
      await markRead.mutateAsync({ id });
      refetch();
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkAllRead = async () => {
    const unread = notifications?.filter(n => !n.isRead) || [];
    for (const n of unread) {
      try { await markRead.mutateAsync({ id: n.id }); } catch {}
    }
    refetch();
  };

  if (!user) return null;

  const unreadCount = notifications?.filter(n => !n.isRead).length || 0;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Notifications</h1>
          <p className="text-[#a7b0c0] text-sm mt-1">
            {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"} · {notifications?.length || 0} total
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg border border-white/[0.08] text-[#a7b0c0] hover:border-[#22d3ee]/40 hover:text-[#22d3ee] transition-all"
          >
            <CheckCheck size={13} />
            Mark all read
          </button>
        )}
      </div>

      {/* Notifications list */}
      <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="flex items-center gap-3 p-6">
            <Loader2 size={18} className="animate-spin text-[#ff2e88]" />
            <span className="text-[#a7b0c0] text-sm">Loading notifications...</span>
          </div>
        ) : !notifications?.length ? (
          <div className="text-center py-12">
            <div className="w-14 h-14 rounded-full bg-white/[0.04] flex items-center justify-center mx-auto mb-4">
              <Bell size={24} className="text-[#a7b0c0]" />
            </div>
            <p className="text-white font-medium">No notifications</p>
            <p className="text-[#a7b0c0] text-sm mt-1">You're all caught up!</p>
          </div>
        ) : (
          <div>
            {notifications.map((notif, idx) => (
              <div
                key={notif.id}
                className={`
                  flex items-start gap-4 p-5 transition-all
                  ${idx !== notifications.length - 1 ? "border-b border-white/[0.05]" : ""}
                  ${!notif.isRead ? "bg-[#ff2e88]/[0.03]" : ""}
                  hover:bg-white/[0.02]
                `}
              >
                <NotifIcon type={notif.type} />

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className={`text-sm leading-relaxed ${notif.isRead ? "text-[#a7b0c0]" : "text-white font-medium"}`}>
                      {notif.message}
                    </p>
                    {!notif.isRead && (
                      <div className="w-2 h-2 rounded-full bg-[#ff2e88] shrink-0 mt-1.5 shadow-[0_0_6px_rgba(255,46,136,0.8)]" />
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-[10px] text-[#a7b0c0] font-mono">
                      {format(new Date(notif.createdAt), "MMM d · HH:mm")}
                    </span>
                    <span className="text-[10px] text-[#a7b0c0] bg-white/[0.05] px-2 py-0.5 rounded-full capitalize">
                      {notif.type.replace(/_/g, " ")}
                    </span>
                    {!notif.isRead && (
                      <button
                        onClick={() => handleMarkRead(notif.id)}
                        disabled={markRead.isPending}
                        className="text-[10px] text-[#22d3ee] hover:underline disabled:opacity-50 ml-auto"
                      >
                        Mark read
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
