import { useGetTrips, useGetPickupPoints, useCreateBooking } from "@workspace/api-client-react";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { format, addDays } from "date-fns";
import {
  Clock, CheckCircle2, ChevronRight, Loader2,
  CalendarDays, Info, Navigation, ArrowRight, ArrowLeft, Users,
} from "lucide-react";
import { RouteMap } from "@/components/route-map";

type Direction = "inbound" | "outbound";

const TIME_SLOTS: Record<Direction, string[]> = {
  inbound:  ["08:00 AM", "10:00 AM", "12:00 PM", "02:00 PM", "04:00 PM", "06:00 PM"],
  outbound: ["01:00 PM", "03:00 PM", "05:00 PM", "07:00 PM"],
};

function SegmentBar({ booked, total, min }: { booked: number; total: number; min: number }) {
  const segments = Math.min(total, 20);
  const filledSegments = Math.round((booked / total) * segments);
  const minSegments = Math.round((min / total) * segments);
  return (
    <div className="space-y-2">
      <div className="flex gap-0.5">
        {Array.from({ length: segments }, (_, i) => (
          <div key={i} className={`flex-1 h-1.5 rounded-full transition-all duration-300 ${
            i < filledSegments
              ? i >= minSegments - 1
                ? "bg-emerald-400 shadow-[0_0_4px_rgba(52,211,153,0.8)]"
                : "bg-[#ff2e88] shadow-[0_0_4px_rgba(255,46,136,0.8)]"
              : "bg-white/10"
          }`} />
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
  const { data: pickupPoints } = useGetPickupPoints();
  const createBooking = useCreateBooking();

  const [direction, setDirection]       = useState<Direction>("inbound");
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [customCoords, setCustomCoords] = useState<[number, number] | null>(null);

  const handleDirectionChange = (dir: Direction) => {
    setDirection(dir);
    setSelectedTime(null);
  };

  const handleLocationSelect = useCallback((coords: [number, number]) => {
    setCustomCoords(coords);
  }, []);

  const matchedTrip = trips?.find(t => {
    const norm = (s: string) => s.replace(/\s/g, "").toUpperCase();
    return norm(t.departureTime) === norm(selectedTime ?? "");
  });

  const canBook = selectedTime !== null && customCoords !== null;

  const handleBook = async () => {
    if (!selectedTime || !customCoords) return;
    try {
      const tripId = matchedTrip?.id ?? null;
      const pickupPointId = pickupPoints?.[0]?.id ?? 1;

      if (!tripId) {
        toast({ title: "No matching trip", description: "The selected time has no available trip for tomorrow.", variant: "destructive" });
        return;
      }

      await createBooking.mutateAsync({
        data: {
          tripId,
          pickupPointId,
          customLat: customCoords[0],
          customLng: customCoords[1],
          pickupType: "custom",
        },
      });

      toast({
        title: "Booking confirmed!",
        description: `${direction === "inbound" ? "Go to 42 Irbid" : "Return from 42 Irbid"} · ${selectedTime} · Pickup at ${customCoords[0].toFixed(4)}, ${customCoords[1].toFixed(4)}`,
      });
      setLocation("/dashboard");
    } catch (err: any) {
      toast({ title: "Booking failed", description: err?.message || "Please try again.", variant: "destructive" });
    }
  };

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

          {/* Step 1: Direction + Time */}
          <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/[0.06] flex items-center gap-3">
              <div className="w-6 h-6 rounded-full bg-[#ff2e88]/20 border border-[#ff2e88]/30 flex items-center justify-center text-xs font-bold text-[#ff2e88]">1</div>
              <span className="font-semibold text-white text-sm">Select Trip &amp; Time</span>
            </div>

            <div className="p-4 space-y-4">
              {/* Direction Toggle */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-white/[0.04] rounded-xl border border-white/[0.06]">
                <button
                  onClick={() => handleDirectionChange("inbound")}
                  className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-semibold transition-all duration-200 ${
                    direction === "inbound"
                      ? "bg-[#ff2e88] text-white shadow-[0_0_14px_rgba(255,46,136,0.35)]"
                      : "text-[#a7b0c0] hover:text-white"
                  }`}
                >
                  <ArrowRight size={14} />
                  Go to 42 Irbid
                </button>
                <button
                  onClick={() => handleDirectionChange("outbound")}
                  className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-semibold transition-all duration-200 ${
                    direction === "outbound"
                      ? "bg-[#22d3ee] text-[#0d1117] shadow-[0_0_14px_rgba(34,211,238,0.35)]"
                      : "text-[#a7b0c0] hover:text-white"
                  }`}
                >
                  <ArrowLeft size={14} />
                  Return from 42
                </button>
              </div>

              {/* Time Slot Chips */}
              {tripsLoading ? (
                <div className="flex items-center gap-2 py-3 text-[#a7b0c0] text-sm">
                  <Loader2 size={16} className="animate-spin" />Loading trip availability...
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-[#a7b0c0] font-medium uppercase tracking-wider">Available times</p>
                  <div className="flex flex-wrap gap-2">
                    {TIME_SLOTS[direction].map((slot) => {
                      const trip = trips?.find(t => {
                        const norm = (s: string) => s.replace(/\s/g, "").toUpperCase();
                        return norm(t.departureTime) === norm(slot);
                      });
                      const isFull = trip ? trip.availableSeats <= 0 : false;
                      const hasTrip = Boolean(trip);
                      const isSelected = selectedTime === slot;

                      return (
                        <button
                          key={slot}
                          onClick={() => !isFull && setSelectedTime(isSelected ? null : slot)}
                          disabled={isFull}
                          className={`relative flex flex-col items-center gap-0.5 px-4 py-2.5 rounded-xl border text-sm font-mono font-bold transition-all duration-150 ${
                            isSelected
                              ? direction === "inbound"
                                ? "border-[#ff2e88]/60 bg-[#ff2e88]/15 text-[#ff2e88] shadow-[0_0_14px_rgba(255,46,136,0.2)]"
                                : "border-[#22d3ee]/60 bg-[#22d3ee]/15 text-[#22d3ee] shadow-[0_0_14px_rgba(34,211,238,0.2)]"
                              : isFull
                                ? "border-white/[0.05] bg-white/[0.02] text-white/20 cursor-not-allowed"
                                : "border-white/[0.08] bg-white/[0.02] text-white hover:border-white/25 hover:bg-white/[0.05]"
                          }`}
                        >
                          <div className="flex items-center gap-1.5">
                            <Clock size={12} className={isSelected ? (direction === "inbound" ? "text-[#ff2e88]" : "text-[#22d3ee]") : "text-[#a7b0c0]"} />
                            {slot}
                          </div>
                          {isFull && <span className="text-[9px] font-sans font-normal text-red-400/80">Full</span>}
                          {hasTrip && !isFull && trip && (
                            <span className={`text-[9px] font-sans font-normal flex items-center gap-0.5 ${isSelected ? "opacity-80" : "text-[#a7b0c0]"}`}>
                              <Users size={8} />{trip.availableSeats} left
                            </span>
                          )}
                          {isSelected && (
                            <CheckCircle2 size={12} className={`absolute -top-1.5 -right-1.5 ${direction === "inbound" ? "text-[#ff2e88]" : "text-[#22d3ee]"}`} />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {trips?.length === 0 && (
                    <div className="flex items-center gap-2 py-2 text-[#a7b0c0] text-sm">
                      <Info size={15} />No trips scheduled for tomorrow.
                    </div>
                  )}
                </div>
              )}

              {/* Seat info for selected trip */}
              {matchedTrip && (
                <div className="pt-3 border-t border-white/[0.06]">
                  <p className="text-xs text-[#a7b0c0] mb-2">Seat availability for selected trip</p>
                  <SegmentBar booked={matchedTrip.bookedSeats} total={matchedTrip.totalSeats} min={matchedTrip.minBookingsToConfirm} />
                </div>
              )}
            </div>
          </div>

          {/* Step 2: Map (always visible) */}
          <div className="bg-white/[0.03] border border-[#22d3ee]/20 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/[0.06] flex items-center gap-3">
              <div className="w-6 h-6 rounded-full bg-[#22d3ee]/20 border border-[#22d3ee]/30 flex items-center justify-center text-xs font-bold text-[#22d3ee]">2</div>
              <span className="font-semibold text-white text-sm">Select Pickup on Map</span>
            </div>

            <div className="px-5 py-3 bg-[#22d3ee]/[0.05] border-b border-[#22d3ee]/10 flex items-start gap-2.5">
              <Navigation size={14} className="text-[#22d3ee] mt-0.5 shrink-0" />
              <p className="text-sm text-[#22d3ee]/90 leading-relaxed">
                Click anywhere on the <strong className="text-white">highlighted pink bus route</strong> to set your exact pickup location. Points off-route will be rejected.
              </p>
            </div>

            <div className="rounded-b-xl overflow-hidden">
              <RouteMap
                height="340px"
                showBus={false}
                onLocationSelect={handleLocationSelect}
                selectedCoords={customCoords}
              />
            </div>

            {customCoords && (
              <div className="px-5 py-3 border-t border-emerald-400/20 bg-emerald-400/[0.05] flex items-center gap-2">
                <CheckCircle2 size={14} className="text-emerald-400" />
                <span className="text-xs text-emerald-300 font-medium">
                  Pickup confirmed at {customCoords[0].toFixed(5)}, {customCoords[1].toFixed(5)}
                </span>
                <button
                  onClick={() => setCustomCoords(null)}
                  className="ml-auto text-[10px] text-[#a7b0c0] hover:text-white underline"
                >
                  Clear
                </button>
              </div>
            )}
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
                  <span className="text-sm text-[#a7b0c0]">Direction</span>
                  <span className={`text-sm font-medium flex items-center gap-1.5 ${direction === "inbound" ? "text-[#ff2e88]" : "text-[#22d3ee]"}`}>
                    {direction === "inbound" ? <ArrowRight size={13} /> : <ArrowLeft size={13} />}
                    {direction === "inbound" ? "Go to 42" : "Return from 42"}
                  </span>
                </div>

                <div className="flex justify-between items-center py-2.5 border-b border-white/[0.05]">
                  <span className="text-sm text-[#a7b0c0]">Departure</span>
                  <span className={`text-sm font-mono font-bold ${selectedTime ? (direction === "inbound" ? "text-[#ff2e88]" : "text-[#22d3ee]") : "text-white/30"}`}>
                    {selectedTime || "—"}
                  </span>
                </div>

                <div className="flex justify-between items-center py-2.5">
                  <span className="text-sm text-[#a7b0c0]">Pickup</span>
                  <span className={`text-sm font-medium text-right max-w-[140px] ${customCoords ? "text-emerald-400" : "text-amber-400/80"}`}>
                    {customCoords ? "Custom (on-route)" : "Select on map →"}
                  </span>
                </div>

                {customCoords && (
                  <div className="flex justify-between items-center py-2 bg-emerald-400/[0.05] border border-emerald-400/20 rounded-lg px-3">
                    <span className="text-xs text-[#a7b0c0]">Coords</span>
                    <span className="text-xs font-mono text-emerald-400">{customCoords[0].toFixed(4)}, {customCoords[1].toFixed(4)}</span>
                  </div>
                )}
              </div>

              {matchedTrip && (
                <div className="pt-3 border-t border-white/[0.06]">
                  <p className="text-xs text-[#a7b0c0] mb-2">Seat availability</p>
                  <SegmentBar booked={matchedTrip.bookedSeats} total={matchedTrip.totalSeats} min={matchedTrip.minBookingsToConfirm} />
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
                <p className="text-xs text-center text-[#a7b0c0]">
                  {!selectedTime && !customCoords
                    ? "Pick a direction, time, and your pickup on the map"
                    : !selectedTime
                      ? "Select a departure time above"
                      : "Click the map route to set your pickup point"}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
