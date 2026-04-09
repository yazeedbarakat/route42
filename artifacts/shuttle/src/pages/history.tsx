import { useGetBookingHistory, useCancelBooking } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { Clock, MapPin, Calendar, CheckCircle2, AlertCircle, XCircle, Loader2, History } from "lucide-react";

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
      <XCircle size={11} />Cancelled
    </span>
  );
}

export default function BookingHistory() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    if (!user) setLocation("/");
    else if (user.role !== "student") setLocation(user.role === "admin" ? "/admin" : "/driver");
  }, [user, setLocation]);

  const { data: bookings, isLoading, refetch } = useGetBookingHistory();
  const cancelBooking = useCancelBooking();

  const handleCancel = async (id: number) => {
    if (!confirm("Are you sure you want to cancel this booking?")) return;
    try {
      await cancelBooking.mutateAsync({ id });
      toast({ title: "Booking cancelled", description: "Your booking has been cancelled successfully." });
      refetch();
    } catch (err: any) {
      toast({ title: "Cancel failed", description: err?.message || "Please try again.", variant: "destructive" });
    }
  };

  if (!user) return null;

  const totalBookings = bookings?.length || 0;
  const confirmedCount = bookings?.filter(b => b.status === "confirmed").length || 0;
  const pendingCount = bookings?.filter(b => b.status === "pending").length || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Booking History</h1>
        <p className="text-[#a7b0c0] text-sm mt-1">{totalBookings} total bookings found</p>
      </div>

      {/* Summary pills */}
      {!isLoading && totalBookings > 0 && (
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-sm">
            <div className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="text-white font-medium">{confirmedCount}</span>
            <span className="text-[#a7b0c0]">confirmed</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-sm">
            <div className="w-2 h-2 rounded-full bg-amber-400" />
            <span className="text-white font-medium">{pendingCount}</span>
            <span className="text-[#a7b0c0]">pending</span>
          </div>
        </div>
      )}

      {/* Bookings list */}
      <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="flex items-center gap-3 p-6">
            <Loader2 size={18} className="animate-spin text-[#ff2e88]" />
            <span className="text-[#a7b0c0] text-sm">Loading your booking history...</span>
          </div>
        ) : bookings?.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-14 h-14 rounded-full bg-white/[0.04] flex items-center justify-center mx-auto mb-4">
              <History size={24} className="text-[#a7b0c0]" />
            </div>
            <p className="text-white font-medium">No bookings yet</p>
            <p className="text-[#a7b0c0] text-sm mt-1">Your booking history will appear here</p>
          </div>
        ) : (
          <div>
            {bookings?.map((booking, idx) => (
              <div
                key={booking.id}
                className={`p-5 flex flex-col sm:flex-row sm:items-center gap-4 ${
                  idx !== bookings.length - 1 ? "border-b border-white/[0.06]" : ""
                } hover:bg-white/[0.02] transition-colors`}
              >
                {/* Date block */}
                <div className="w-14 h-14 rounded-xl bg-white/[0.05] border border-white/[0.08] flex flex-col items-center justify-center shrink-0">
                  <span className="text-xs text-[#a7b0c0] leading-none">
                    {format(new Date(booking.trip?.date || ""), "MMM")}
                  </span>
                  <span className="text-xl font-bold text-white leading-none mt-0.5">
                    {format(new Date(booking.trip?.date || ""), "d")}
                  </span>
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                    <span className="flex items-center gap-1.5 text-sm text-white font-semibold">
                      <Clock size={13} className="text-[#ff2e88]" />
                      <span className="font-mono">{booking.trip?.departureTime}</span>
                    </span>
                    <span className="flex items-center gap-1.5 text-sm text-[#a7b0c0]">
                      <MapPin size={13} className="text-[#22d3ee]" />
                      {booking.pickupPoint?.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-xs text-[#a7b0c0] font-mono">
                      #{String(booking.id).padStart(6, "0")}
                    </span>
                    <span className="text-[#a7b0c0]">·</span>
                    <span className="text-xs text-[#a7b0c0]">
                      {format(new Date(booking.createdAt || ""), "MMM d, HH:mm")}
                    </span>
                  </div>
                </div>

                {/* Status + action */}
                <div className="flex items-center gap-3 shrink-0">
                  <StatusBadge status={booking.status} />
                  {booking.status === "pending" && (
                    <button
                      onClick={() => handleCancel(booking.id)}
                      disabled={cancelBooking.isPending}
                      className="text-xs px-3 py-1.5 rounded-lg border border-red-400/30 text-red-400 hover:bg-red-400/10 transition-colors disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
