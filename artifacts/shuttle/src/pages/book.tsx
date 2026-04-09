import { useGetTrips, useGetPickupPoints, useCreateBooking } from "@workspace/api-client-react";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { format, addDays } from "date-fns";
import { Clock, MapPin, Users, CheckCircle2, ChevronRight, Loader2, CalendarDays, Info } from "lucide-react";

function SegmentBar({ booked, total, min }: { booked: number; total: number; min: number }) {
  const segments = Math.min(total, 20);
  const filledSegments = Math.round((booked / total) * segments);
  const minSegments = Math.round((min / total) * segments);

  return (
    <div className="space-y-2">
      <div className="flex gap-0.5">
        {Array.from({ length: segments }, (_, i) => (
          <div
            key={i}
            className={`flex-1 h-1.5 rounded-full transition-all duration-300 ${
              i < filledSegments
                ? i >= minSegments - 1
                  ? "bg-emerald-400 shadow-[0_0_4px_rgba(52,211,153,0.8)]"
                  : "bg-[#ff2e88] shadow-[0_0_4px_rgba(255,46,136,0.8)]"
                : "bg-white/10"
            }`}
          />
        ))}
      </div>
      <div className="flex justify-between text-xs text-[#a7b0c0]">
        <span className="font-mono">{booked} / {total} seats filled</span>
        <span>{min} needed to confirm</span>
      </div>
    </div>
  );
}

export default function Book() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    if (!user) setLocation("/");
    else if (user.role !== "student") setLocation(user.role === "admin" ? "/admin" : "/driver");
  }, [user, setLocation]);

  const tomorrow = format(addDays(new Date(), 1), "yyyy-MM-dd");
  const { data: trips, isLoading: tripsLoading } = useGetTrips({ date: tomorrow });
  const { data: pickupPoints, isLoading: pointsLoading } = useGetPickupPoints();
  const createBooking = useCreateBooking();

  const [selectedTrip, setSelectedTrip] = useState<number | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<number | null>(null);

  const handleBook = async () => {
    if (!selectedTrip || !selectedPoint) return;
    try {
      await createBooking.mutateAsync({ data: { tripId: selectedTrip, pickupPointId: selectedPoint } });
      toast({ title: "Booking confirmed!", description: "Your seat has been reserved." });
      setLocation("/dashboard");
    } catch (err: any) {
      toast({ title: "Booking failed", description: err?.message || "Please try again.", variant: "destructive" });
    }
  };

  const activeTrip = trips?.find(t => t.id === selectedTrip);
  const activePoint = pickupPoints?.find(p => p.id === selectedPoint);
  const canBook = selectedTrip !== null && selectedPoint !== null;

  if (!user) return null;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Book a Ride</h1>
        <p className="text-[#a7b0c0] text-sm mt-1 flex items-center gap-1.5">
          <CalendarDays size={14} />
          Booking for <span className="text-white font-medium">{format(addDays(new Date(), 1), "EEEE, MMMM d")}</span>
        </p>
      </div>

      <div className="grid lg:grid-cols-5 gap-5">
        {/* Left: Selection panels */}
        <div className="lg:col-span-3 space-y-5">
          {/* Step 1: Time */}
          <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/[0.06] flex items-center gap-3">
              <div className="w-6 h-6 rounded-full bg-[#ff2e88]/20 border border-[#ff2e88]/30 flex items-center justify-center text-xs font-bold text-[#ff2e88]">1</div>
              <span className="font-semibold text-white text-sm">Select Departure Time</span>
            </div>
            <div className="p-4">
              {tripsLoading ? (
                <div className="flex items-center gap-2 py-4 text-[#a7b0c0] text-sm">
                  <Loader2 size={16} className="animate-spin" />Loading available trips...
                </div>
              ) : trips?.length === 0 ? (
                <div className="flex items-center gap-2 py-4 text-[#a7b0c0] text-sm">
                  <Info size={15} />No trips available for tomorrow.
                </div>
              ) : (
                <div className="space-y-2">
                  {trips?.map((trip) => {
                    const isFull = trip.availableSeats <= 0;
                    const isSelected = selectedTrip === trip.id;
                    const fillPct = (trip.bookedSeats / trip.totalSeats) * 100;
                    return (
                      <button
                        key={trip.id}
                        onClick={() => !isFull && setSelectedTrip(trip.id)}
                        disabled={isFull}
                        className={`w-full text-left rounded-lg border p-4 transition-all duration-150 ${
                          isSelected
                            ? "border-[#ff2e88]/50 bg-[#ff2e88]/10 shadow-[0_0_16px_rgba(255,46,136,0.1)]"
                            : isFull
                              ? "border-white/[0.05] opacity-40 cursor-not-allowed bg-white/[0.02]"
                              : "border-white/[0.08] bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <Clock size={15} className={isSelected ? "text-[#ff2e88]" : "text-[#a7b0c0]"} />
                            <span className={`font-mono text-base font-bold ${isSelected ? "text-[#ff2e88]" : "text-white"}`}>
                              {trip.departureTime}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {isFull ? (
                              <span className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 px-2 py-0.5 rounded-full">Full</span>
                            ) : (
                              <span className="text-xs text-[#a7b0c0] flex items-center gap-1">
                                <Users size={11} />{trip.availableSeats} left
                              </span>
                            )}
                            {isSelected && <CheckCircle2 size={16} className="text-[#ff2e88]" />}
                          </div>
                        </div>
                        <div className="flex gap-0.5">
                          {Array.from({ length: 20 }, (_, i) => {
                            const filled = i < Math.round((trip.bookedSeats / trip.totalSeats) * 20);
                            return (
                              <div key={i} className={`flex-1 h-1 rounded-full ${filled ? (isSelected ? "bg-[#ff2e88]" : "bg-[#ff2e88]/60") : "bg-white/10"}`} />
                            );
                          })}
                        </div>
                        <div className="text-xs text-[#a7b0c0] mt-1.5">
                          {trip.bookedSeats}/{trip.totalSeats} booked · {trip.minBookingsToConfirm} to confirm
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Step 2: Pickup */}
          <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/[0.06] flex items-center gap-3">
              <div className="w-6 h-6 rounded-full bg-[#22d3ee]/20 border border-[#22d3ee]/30 flex items-center justify-center text-xs font-bold text-[#22d3ee]">2</div>
              <span className="font-semibold text-white text-sm">Select Pickup Point</span>
            </div>
            <div className="p-4">
              {pointsLoading ? (
                <div className="flex items-center gap-2 py-4 text-[#a7b0c0] text-sm">
                  <Loader2 size={16} className="animate-spin" />Loading pickup points...
                </div>
              ) : (
                <div className="space-y-2">
                  {pickupPoints?.map((point) => {
                    const isSelected = selectedPoint === point.id;
                    return (
                      <button
                        key={point.id}
                        onClick={() => setSelectedPoint(point.id)}
                        className={`w-full text-left rounded-lg border p-4 transition-all duration-150 ${
                          isSelected
                            ? "border-[#22d3ee]/50 bg-[#22d3ee]/10 shadow-[0_0_16px_rgba(34,211,238,0.1)]"
                            : "border-white/[0.08] bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isSelected ? "bg-[#22d3ee]/20" : "bg-white/[0.05]"}`}>
                            <MapPin size={15} className={isSelected ? "text-[#22d3ee]" : "text-[#a7b0c0]"} />
                          </div>
                          <div className="flex-1">
                            <div className={`font-medium text-sm ${isSelected ? "text-[#22d3ee]" : "text-white"}`}>{point.name}</div>
                            {point.address && <div className="text-xs text-[#a7b0c0] mt-0.5">{point.address}</div>}
                          </div>
                          {isSelected && <CheckCircle2 size={16} className="text-[#22d3ee] shrink-0" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: Summary */}
        <div className="lg:col-span-2">
          <div className="sticky top-4 bg-white/[0.03] border border-white/[0.08] rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/[0.06]">
              <h3 className="font-semibold text-white text-sm">Booking Summary</h3>
            </div>
            <div className="p-5 space-y-4">
              <div className="space-y-3">
                <div className="flex justify-between items-center py-2.5 border-b border-white/[0.05]">
                  <span className="text-sm text-[#a7b0c0]">Date</span>
                  <span className="text-sm font-medium text-white">{format(addDays(new Date(), 1), "MMM d, yyyy")}</span>
                </div>
                <div className="flex justify-between items-center py-2.5 border-b border-white/[0.05]">
                  <span className="text-sm text-[#a7b0c0]">Departure</span>
                  <span className={`text-sm font-mono font-bold ${activeTrip ? "text-[#ff2e88]" : "text-white/30"}`}>
                    {activeTrip?.departureTime || "—"}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2.5">
                  <span className="text-sm text-[#a7b0c0]">Pickup</span>
                  <span className={`text-sm font-medium text-right max-w-[140px] ${activePoint ? "text-[#22d3ee]" : "text-white/30"}`}>
                    {activePoint?.name || "—"}
                  </span>
                </div>
              </div>

              {activeTrip && (
                <div className="pt-3 border-t border-white/[0.06]">
                  <p className="text-xs text-[#a7b0c0] mb-2">Seat availability</p>
                  <SegmentBar
                    booked={activeTrip.bookedSeats}
                    total={activeTrip.totalSeats}
                    min={activeTrip.minBookingsToConfirm}
                  />
                </div>
              )}

              <button
                onClick={handleBook}
                disabled={!canBook || createBooking.isPending}
                className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-semibold text-sm transition-all duration-200 mt-2 ${
                  canBook
                    ? "bg-gradient-to-r from-[#ff2e88] to-[#e0176b] hover:from-[#ff4595] hover:to-[#ff2e88] text-white shadow-lg hover:shadow-[0_0_20px_rgba(255,46,136,0.4)]"
                    : "bg-white/[0.05] text-white/30 cursor-not-allowed"
                }`}
              >
                {createBooking.isPending ? (
                  <><Loader2 size={16} className="animate-spin" />Reserving seat...</>
                ) : (
                  <>Confirm Booking <ChevronRight size={16} /></>
                )}
              </button>

              {!canBook && (
                <p className="text-xs text-center text-[#a7b0c0]">Select a time slot and pickup point to continue</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
