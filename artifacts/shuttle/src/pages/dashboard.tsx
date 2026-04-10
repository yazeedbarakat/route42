import { useGetBookings } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { Link, useLocation } from "wouter";
import { useEffect } from "react";
import { format } from "date-fns";
import { CalendarPlus, Map, Clock, MapPin, CheckCircle2, AlertCircle, ArrowRight, Zap } from "lucide-react";

function StatusBadge({ status }: { status: string }) {
  if (status === "confirmed") return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-400/10 text-emerald-400 border border-emerald-400/20">
      <CheckCircle2 size={11} />Confirmed
    </span>
  );
  if (status === "pending") return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-400/10 text-amber-400 border border-amber-400/20">
      <AlertCircle size={11} />Pending
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-400/10 text-red-400 border border-red-400/20">
      Cancelled
    </span>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!user) setLocation("/");
    else if (user.role !== "student") setLocation(user.role === "admin" ? "/admin" : "/driver");
  }, [user, setLocation]);

  const { data: bookings, isLoading } = useGetBookings();
  if (!user) return null;

  const upcomingBookings = bookings?.filter(b => b.status === "pending" || b.status === "confirmed") || [];
  const confirmedCount = bookings?.filter(b => b.status === "confirmed").length || 0;
  const pendingCount = bookings?.filter(b => b.status === "pending").length || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">
          Welcome back, <span className="text-[#22d3ee]">{user.name.split(" ")[0]}</span> 👋
        </h1>
        <p className="text-[#a7b0c0] mt-1 text-sm">Here's your shuttle activity at a glance.</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-400/10 flex items-center justify-center">
              <CheckCircle2 size={16} className="text-emerald-400" />
            </div>
            <span className="text-xs text-[#a7b0c0] font-medium">Confirmed</span>
          </div>
          <div className="text-3xl font-bold text-white font-mono">{confirmedCount}</div>
        </div>

        <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-amber-400/10 flex items-center justify-center">
              <AlertCircle size={16} className="text-amber-400" />
            </div>
            <span className="text-xs text-[#a7b0c0] font-medium">Pending</span>
          </div>
          <div className="text-3xl font-bold text-white font-mono">{pendingCount}</div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Link href="/book">
          <div className="group relative bg-gradient-to-br from-[#ff2e88]/20 to-[#7c3aed]/20 border border-[#ff2e88]/25 rounded-xl p-5 cursor-pointer hover:border-[#ff2e88]/50 transition-all duration-200 hover:shadow-[0_0_20px_rgba(255,46,136,0.15)]">
            <div className="flex items-start justify-between mb-4">
              <div className="w-10 h-10 rounded-xl bg-[#ff2e88]/20 flex items-center justify-center">
                <CalendarPlus size={20} className="text-[#ff2e88]" />
              </div>
              <ArrowRight size={16} className="text-[#ff2e88]/50 group-hover:text-[#ff2e88] transition-colors group-hover:translate-x-0.5 transform duration-150" />
            </div>
            <div className="text-base font-semibold text-white">Book a Ride</div>
            <div className="text-xs text-[#a7b0c0] mt-0.5">Reserve your seat for tomorrow</div>
          </div>
        </Link>

        <Link href="/map">
          <div className="group relative bg-gradient-to-br from-[#22d3ee]/10 to-[#0ea5e9]/10 border border-[#22d3ee]/25 rounded-xl p-5 cursor-pointer hover:border-[#22d3ee]/50 transition-all duration-200 hover:shadow-[0_0_20px_rgba(34,211,238,0.15)]">
            <div className="flex items-start justify-between mb-4">
              <div className="w-10 h-10 rounded-xl bg-[#22d3ee]/15 flex items-center justify-center">
                <Map size={20} className="text-[#22d3ee]" />
              </div>
              <ArrowRight size={16} className="text-[#22d3ee]/50 group-hover:text-[#22d3ee] transition-colors group-hover:translate-x-0.5 transform duration-150" />
            </div>
            <div className="text-base font-semibold text-white">Route Map</div>
            <div className="text-xs text-[#a7b0c0] mt-0.5">View pickup points & route</div>
          </div>
        </Link>
      </div>

      {/* Upcoming bookings */}
      <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <Zap size={16} className="text-[#ff2e88]" />
            <h2 className="font-semibold text-white text-sm">Upcoming Trips</h2>
          </div>
          <Link href="/history">
            <span className="text-xs text-[#22d3ee] hover:text-white transition-colors flex items-center gap-1">
              View all <ArrowRight size={12} />
            </span>
          </Link>
        </div>

        <div className="p-4">
          {isLoading ? (
            <div className="flex items-center gap-3 py-4">
              <div className="w-5 h-5 border-2 border-[#ff2e88]/30 border-t-[#ff2e88] rounded-full animate-spin" />
              <span className="text-sm text-[#a7b0c0]">Loading your trips...</span>
            </div>
          ) : upcomingBookings.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 rounded-full bg-white/[0.04] flex items-center justify-center mx-auto mb-3">
                <CalendarPlus size={22} className="text-[#a7b0c0]" />
              </div>
              <p className="text-sm text-[#a7b0c0]">No upcoming trips</p>
              <Link href="/book">
                <button className="mt-3 text-xs text-[#ff2e88] hover:underline">Book one now →</button>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {upcomingBookings.map((booking) => (
                <div key={booking.id} className="flex items-center gap-4 p-3 rounded-lg bg-white/[0.03] border border-white/[0.05] hover:border-white/[0.1] transition-colors">
                  <div className="w-10 h-10 rounded-lg bg-[#ff2e88]/10 border border-[#ff2e88]/20 flex items-center justify-center shrink-0">
                    <Clock size={16} className="text-[#ff2e88]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-white font-mono">{booking.trip?.departureTime}</span>
                      <span className="text-[#a7b0c0] text-xs">·</span>
                      <span className="text-xs text-[#a7b0c0]">{format(new Date(booking.trip?.date || ""), "MMM d")}</span>
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <MapPin size={11} className="text-[#a7b0c0]" />
                      <span className="text-xs text-[#a7b0c0] truncate">
                        {booking.pickupType === "fixed"
                          ? (booking.pickupName || booking.pickupPoint?.name || "Fixed Pickup")
                          : "Custom Pickup"}
                      </span>
                    </div>
                  </div>
                  <StatusBadge status={booking.status} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
