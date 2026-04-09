import { useGetAdminBookings } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Search, Filter, CheckCircle2, AlertCircle, XCircle, Loader2, BookOpen } from "lucide-react";

function StatusBadge({ status }: { status: string }) {
  if (status === "confirmed") return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-400/10 text-emerald-400 border border-emerald-400/20">
      <CheckCircle2 size={10} />Confirmed
    </span>
  );
  if (status === "pending") return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-400/10 text-amber-400 border border-amber-400/20">
      <AlertCircle size={10} />Pending
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-400/10 text-red-400 border border-red-400/20">
      <XCircle size={10} />Cancelled
    </span>
  );
}

export default function AdminBookings() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!user) setLocation("/");
    else if (user.role !== "admin") setLocation(user.role === "student" ? "/dashboard" : "/driver");
  }, [user, setLocation]);

  const [dateFilter, setDateFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const { data: bookings, isLoading } = useGetAdminBookings({
    date: dateFilter || undefined,
    status: statusFilter || undefined,
  });

  if (!user) return null;

  return (
    <div className="space-y-6">
      {/* Header + filters */}
      <div className="flex flex-col sm:flex-row sm:items-start gap-4">
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white">All Bookings</h1>
          <p className="text-[#a7b0c0] text-sm mt-1">
            {bookings?.length || 0} records found
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative">
            <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a7b0c0]" />
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="bg-white/[0.05] border border-white/[0.08] rounded-lg pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:border-[#ff2e88]/50 transition-colors"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-white/[0.05] border border-white/[0.08] rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-[#ff2e88]/50 transition-colors"
          >
            <option value="" className="bg-[#0f1420]">All statuses</option>
            <option value="pending" className="bg-[#0f1420]">Pending</option>
            <option value="confirmed" className="bg-[#0f1420]">Confirmed</option>
            <option value="canceled" className="bg-[#0f1420]">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="flex items-center gap-3 p-6">
            <Loader2 size={18} className="animate-spin text-[#ff2e88]" />
            <span className="text-[#a7b0c0] text-sm">Loading bookings...</span>
          </div>
        ) : !bookings?.length ? (
          <div className="text-center py-12">
            <div className="w-14 h-14 rounded-full bg-white/[0.04] flex items-center justify-center mx-auto mb-4">
              <BookOpen size={22} className="text-[#a7b0c0]" />
            </div>
            <p className="text-white font-medium">No bookings found</p>
            <p className="text-[#a7b0c0] text-sm mt-1">Try adjusting your filters</p>
          </div>
        ) : (
          <>
            {/* Desktop */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    {["ID", "Student", "Trip", "Pickup Point", "Status", "Booked At"].map(h => (
                      <th key={h} className="text-left px-5 py-3 text-xs font-medium text-[#a7b0c0] uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {bookings.map((booking, idx) => (
                    <tr key={booking.id} className={`${idx !== bookings.length - 1 ? "border-b border-white/[0.04]" : ""} hover:bg-white/[0.02] transition-colors`}>
                      <td className="px-5 py-4 font-mono text-xs text-[#a7b0c0]">#{String(booking.id).padStart(6, "0")}</td>
                      <td className="px-5 py-4">
                        <div className="font-medium text-white text-sm">{booking.user?.name}</div>
                        <div className="text-xs text-[#a7b0c0]">{booking.user?.email}</div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="font-mono font-semibold text-white">{booking.trip?.departureTime}</div>
                        <div className="text-xs text-[#a7b0c0]">
                          {format(new Date(booking.trip?.date || ""), "MMM d, yyyy")}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-sm text-[#a7b0c0]">{booking.pickupPoint?.name}</td>
                      <td className="px-5 py-4"><StatusBadge status={booking.status} /></td>
                      <td className="px-5 py-4 text-xs text-[#a7b0c0] font-mono">
                        {format(new Date(booking.createdAt), "MMM d, HH:mm")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-white/[0.06]">
              {bookings.map((booking) => (
                <div key={booking.id} className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-white text-sm">{booking.user?.name}</div>
                      <div className="text-xs text-[#a7b0c0]">{booking.user?.email}</div>
                    </div>
                    <StatusBadge status={booking.status} />
                  </div>
                  <div className="flex items-center gap-4 text-xs text-[#a7b0c0]">
                    <span className="font-mono font-bold text-white">{booking.trip?.departureTime}</span>
                    <span>·</span>
                    <span>{format(new Date(booking.trip?.date || ""), "MMM d")}</span>
                    <span>·</span>
                    <span>{booking.pickupPoint?.name}</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
