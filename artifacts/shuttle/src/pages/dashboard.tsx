import { useState } from "react";
import { useGetBookings, useCancelBooking, getGetDashboardStatsQueryKey, getGetTripDemandQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Link, useLocation } from "wouter";
import { useEffect } from "react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { CalendarPlus, Clock, MapPin, CheckCircle2, AlertCircle, ArrowRight, Zap, XCircle } from "lucide-react";
import { CancelBookingModal } from "@/components/cancel-booking-modal";
import { canCancelBooking, minutesUntilDeparture } from "@/lib/cancel-utils";

type BookingItem = {
  id: number;
  status: string;
  pickupType?: string;
  pickupName?: string | null;
  pickupPoint?: { name: string } | null;
  trip?: {
    date: string;
    departureTime: string;
  } | null;
};

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
  if (status === "waiting") return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-400/10 text-blue-400 border border-blue-400/20">
      <Clock size={11} />Waiting
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-400/10 text-red-400 border border-red-400/20">
      <XCircle size={11} />Cancelled
    </span>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [cancelTarget, setCancelTarget] = useState<BookingItem | null>(null);

  useEffect(() => {
    if (!user) setLocation("/");
    else if (user.role !== "student") setLocation(user.role === "admin" ? "/admin" : "/driver");
  }, [user, setLocation]);

  const { data: bookings, isLoading, refetch } = useGetBookings();
  const cancelMutation = useCancelBooking();

  if (!user) return null;

  const upcomingBookings = bookings?.filter(
    b => b.status === "pending" || b.status === "confirmed" || b.status === "waiting"
  ) || [];
  const confirmedCount = bookings?.filter(b => b.status === "confirmed").length || 0;
  const pendingCount   = bookings?.filter(b => b.status === "pending").length || 0;

  const handleCancelConfirm = async () => {
    if (!cancelTarget) return;
    try {
      await cancelMutation.mutateAsync({ id: cancelTarget.id });
      toast({ title: "Booking cancelled", description: "Your booking has been successfully cancelled." });
      refetch();
      // Silently revalidate admin caches so their view updates
      queryClient.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetTripDemandQueryKey() });
    } catch (err: any) {
      const msg = err?.data?.error ?? err?.message ?? "Please try again.";
      toast({ title: "Cancellation failed", description: msg, variant: "destructive" });
    } finally {
      setCancelTarget(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Confirmation modal */}
      <CancelBookingModal
        open={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        onConfirm={handleCancelConfirm}
        isPending={cancelMutation.isPending}
        departureTime={cancelTarget?.trip?.departureTime}
        date={cancelTarget?.trip?.date}
      />

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
      <div className="grid grid-cols-1 gap-3">
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
              {upcomingBookings.map((booking) => {
                const trip = booking.trip;
                const cancellable = trip ? canCancelBooking(trip) : false;
                const minsLeft = trip ? minutesUntilDeparture(trip) : Infinity;
                const isCancellableStatus = booking.status === "pending" || booking.status === "confirmed" || booking.status === "waiting";

                return (
                  <div
                    key={booking.id}
                    className="flex items-center gap-4 p-3 rounded-lg bg-white/[0.03] border border-white/[0.05] hover:border-white/[0.1] transition-colors"
                  >
                    <div className="w-10 h-10 rounded-lg bg-[#ff2e88]/10 border border-[#ff2e88]/20 flex items-center justify-center shrink-0">
                      <Clock size={16} className="text-[#ff2e88]" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-white font-mono">{trip?.departureTime}</span>
                        <span className="text-[#a7b0c0] text-xs">·</span>
                        <span className="text-xs text-[#a7b0c0]">
                          {trip?.date ? format(new Date(trip.date), "MMM d") : "—"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <MapPin size={11} className="text-[#a7b0c0]" />
                        <span className="text-xs text-[#a7b0c0] truncate">
                          {booking.pickupType === "fixed"
                            ? (booking.pickupName || booking.pickupPoint?.name || "Fixed Pickup")
                            : "Custom Pickup"}
                        </span>
                      </div>
                      {/* Cancellation window warning */}
                      {isCancellableStatus && !cancellable && minsLeft > -60 && (
                        <p className="text-[10px] text-red-400/80 mt-1">
                          Cancellation no longer available.
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <StatusBadge status={booking.status} />

                      {/* Cancel button — only for active bookings */}
                      {isCancellableStatus && (
                        <div className="relative group/tip">
                          <button
                            onClick={() => cancellable && setCancelTarget(booking as BookingItem)}
                            disabled={!cancellable || cancelMutation.isPending}
                            className={`text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${
                              cancellable
                                ? "border-red-400/30 text-red-400 hover:bg-red-400/10 cursor-pointer"
                                : "border-white/[0.06] text-[#a7b0c0]/40 cursor-not-allowed"
                            }`}
                          >
                            Cancel
                          </button>
                          {!cancellable && (
                            <div className="absolute bottom-full right-0 mb-1.5 hidden group-hover/tip:block z-20 pointer-events-none">
                              <div className="bg-[#1a2035] border border-white/[0.1] rounded-lg px-3 py-2 text-[11px] text-[#a7b0c0] whitespace-nowrap shadow-xl">
                                Cancellation no longer available.
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
