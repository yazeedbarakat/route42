import { useGetTrips, useGetPickupPoints, useCreateBooking, useGetBookings, useGetTimeSlots } from "@workspace/api-client-react";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { format, addDays, isToday, parseISO } from "date-fns";
import {
  Clock, CheckCircle2, ChevronRight, Loader2,
  CalendarDays, Info, Navigation, ArrowRight, ArrowLeft, Users,
  AlertCircle, ListOrdered,
} from "lucide-react";
import { RouteMap } from "@/components/route-map";

type Direction = "inbound" | "outbound";

const MAX_CAPACITY = 15;

function parseSlotHour(slot: string): { h: number; m: number } {
  const [time, period] = slot.split(" ");
  let [h, m] = time.split(":").map(Number);
  if (period === "PM" && h !== 12) h += 12;
  if (period === "AM" && h === 12) h = 0;
  return { h, m };
}

function isSlotAvailableToday(slot: string): boolean {
  const { h, m } = parseSlotHour(slot);
  const now = new Date();
  const slotMs = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m).getTime();
  return slotMs - now.getTime() >= 2 * 60 * 60 * 1000; // at least 2 hours away
}

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

  // Date options: today, tomorrow, day after
  const dateOptions = [
    { label: "Today",      sub: format(new Date(), "EEE, MMM d"),         value: format(new Date(), "yyyy-MM-dd") },
    { label: "Tomorrow",   sub: format(addDays(new Date(), 1), "EEE, MMM d"), value: format(addDays(new Date(), 1), "yyyy-MM-dd") },
    { label: "Day After",  sub: format(addDays(new Date(), 2), "EEE, MMM d"), value: format(addDays(new Date(), 2), "yyyy-MM-dd") },
  ];

  const [selectedDate, setSelectedDate] = useState<string>(dateOptions[1].value); // default: tomorrow
  const [direction, setDirection]       = useState<Direction>("inbound");
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [customCoords, setCustomCoords] = useState<[number, number] | null>(null);
  const [isWaitlisted, setIsWaitlisted] = useState(false);

  const { data: trips, isLoading: tripsLoading } = useGetTrips({ date: selectedDate });
  const { data: pickupPoints } = useGetPickupPoints();
  const { data: myBookings } = useGetBookings();
  const { data: timeSlots = [], isLoading: slotsLoading } = useGetTimeSlots(
    { date: selectedDate, direction },
    { query: { refetchInterval: 30_000 } },
  );
  const createBooking = useCreateBooking();

  const activeSlots = timeSlots.map(s => s.timeString);

  // ── Direction conflict: 1 inbound + 1 outbound max per calendar date ─────
  // Map frontend direction to the db value stored on trip.direction
  const dbDirection = direction === "inbound" ? "to_school" : "from_school";
  const directionConflict = myBookings?.some(
    (b) =>
      b.status !== "canceled" &&
      b.trip?.date === selectedDate &&          // compare YYYY-MM-DD only
      b.trip?.direction === dbDirection
  ) ?? false;
  const directionLabel = direction === "inbound" ? "Inbound (Go to 42 Irbid)" : "Outbound (Return from 42 Irbid)";

  const handleDirectionChange = (dir: Direction) => {
    setDirection(dir);
    setSelectedTime(null);
  };

  const handleDateChange = (date: string) => {
    setSelectedDate(date);
    setSelectedTime(null);
  };

  // Track whether the selected location is an official terminal/bus-hub
  const [isTerminalSelected, setIsTerminalSelected] = useState(false);

  // Route-click custom pickup — marks as non-terminal
  const handleLocationSelect = useCallback((coords: [number, number]) => {
    setCustomCoords(coords);
    setIsTerminalSelected(false);
  }, []);

  // Terminal-click — marks as official station, disables custom pickup
  const handleTerminalClick = useCallback((coords: [number, number]) => {
    setCustomCoords(coords);
    setIsTerminalSelected(true);
  }, []);

  const selectedIsToday = selectedDate === dateOptions[0].value;

  const matchedTrip = trips?.find(t => {
    const norm = (s: string) => s.replace(/\s/g, "").toUpperCase();
    return norm(t.departureTime) === norm(selectedTime ?? "");
  });

  const willBeWaitlisted = matchedTrip ? matchedTrip.bookedSeats >= MAX_CAPACITY : false;
  const canBook = selectedTime !== null && customCoords !== null && !directionConflict;

  const handleBook = async () => {
    if (!selectedTime || !customCoords) return;
    try {
      const tripId = matchedTrip?.id ?? null;

      if (!tripId) {
        toast({ title: "No matching trip", description: "The selected time has no available trip for this date.", variant: "destructive" });
        return;
      }

      const result = await createBooking.mutateAsync({
        data: {
          tripId,
          pickupType: "custom",
          customLat: customCoords[0],
          customLng: customCoords[1],
        },
      });

      const wasWaited = (result as any)?.status === "waiting";
      setIsWaitlisted(wasWaited);

      if (wasWaited) {
        toast({
          title: "Added to waiting list",
          description: `This trip is full. You're on the waitlist for ${selectedTime} — we'll notify you if a seat opens up.`,
        });
      } else {
        toast({
          title: "Booking confirmed!",
          description: `${direction === "inbound" ? "Go to 42 Irbid" : "Return from 42 Irbid"} · ${selectedTime} · Pickup set on map.`,
        });
      }
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
          Select your date below — you can book up to 2 days in advance
        </p>
      </div>

      <div className="grid lg:grid-cols-5 gap-5">
        {/* Left: Selection panels */}
        <div className="lg:col-span-3 space-y-5">

          {/* Step 1: Date + Direction + Time */}
          <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/[0.06] flex items-center gap-3">
              <div className="w-6 h-6 rounded-full bg-[#ff2e88]/20 border border-[#ff2e88]/30 flex items-center justify-center text-xs font-bold text-[#ff2e88]">1</div>
              <span className="font-semibold text-white text-sm">Select Trip &amp; Time</span>
            </div>

            <div className="p-4 space-y-4">
              {/* Date Chips */}
              <div>
                <p className="text-xs text-[#a7b0c0] font-medium uppercase tracking-wider mb-2">Date</p>
                <div className="grid grid-cols-3 gap-2">
                  {dateOptions.map((opt) => {
                    const isSelected = selectedDate === opt.value;
                    return (
                      <button
                        key={opt.value}
                        onClick={() => handleDateChange(opt.value)}
                        className={`flex flex-col items-center py-2.5 px-2 rounded-xl border text-center transition-all duration-150 ${
                          isSelected
                            ? "border-[#ff2e88]/50 bg-[#ff2e88]/10 shadow-[0_0_12px_rgba(255,46,136,0.15)]"
                            : "border-white/[0.08] bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]"
                        }`}
                      >
                        <span className={`text-xs font-bold ${isSelected ? "text-[#ff2e88]" : "text-white"}`}>{opt.label}</span>
                        <span className="text-[10px] text-[#a7b0c0] mt-0.5">{opt.sub}</span>
                        {isSelected && <CheckCircle2 size={11} className="text-[#ff2e88] mt-1" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Direction Toggle */}
              <div>
                <p className="text-xs text-[#a7b0c0] font-medium uppercase tracking-wider mb-2">Direction</p>
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
              </div>

              {/* ── Conflict banner: same direction already booked ─────────── */}
              {directionConflict && (
                <div className="flex items-start gap-2.5 p-3 bg-red-500/[0.08] border border-red-500/30 rounded-xl">
                  <AlertCircle size={15} className="text-red-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-red-300">Booking conflict</p>
                    <p className="text-[11px] text-red-400/80 mt-0.5 leading-relaxed">
                      You already have an active <strong className="text-red-300">{directionLabel}</strong> booking for this date. Cancel it first to rebook.
                    </p>
                  </div>
                </div>
              )}

              {/* Time Slot Chips */}
              {tripsLoading || slotsLoading ? (
                <div className="flex items-center gap-2 py-3 text-[#a7b0c0] text-sm">
                  <Loader2 size={16} className="animate-spin" />Loading trip availability...
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-[#a7b0c0] font-medium uppercase tracking-wider">Available times</p>
                  {activeSlots.length === 0 && (
                    <div className="flex items-center gap-2 py-2 text-[#a7b0c0] text-sm">
                      <Info size={15} />No time slots are currently available. Check back soon.
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {activeSlots.map((slot) => {
                      const trip = trips?.find(t => {
                        const norm = (s: string) => s.replace(/\s/g, "").toUpperCase();
                        return norm(t.departureTime) === norm(slot);
                      });
                      const isFull      = trip ? trip.bookedSeats >= trip.totalSeats : false;
                      const isWaitlist  = trip ? trip.bookedSeats >= MAX_CAPACITY : false;
                      const tooSoon     = selectedIsToday && !isSlotAvailableToday(slot);
                      const isDisabled  = isFull || tooSoon;
                      const isSelected  = selectedTime === slot;

                      return (
                        <button
                          key={slot}
                          onClick={() => !isDisabled && setSelectedTime(isSelected ? null : slot)}
                          disabled={isDisabled}
                          className={`relative flex flex-col items-center gap-0.5 px-4 py-2.5 rounded-xl border text-sm font-mono font-bold transition-all duration-150 ${
                            isSelected
                              ? direction === "inbound"
                                ? "border-[#ff2e88]/60 bg-[#ff2e88]/15 text-[#ff2e88] shadow-[0_0_14px_rgba(255,46,136,0.2)]"
                                : "border-[#22d3ee]/60 bg-[#22d3ee]/15 text-[#22d3ee] shadow-[0_0_14px_rgba(34,211,238,0.2)]"
                              : isDisabled
                                ? "border-white/[0.05] bg-white/[0.02] text-white/20 cursor-not-allowed"
                                : "border-white/[0.08] bg-white/[0.02] text-white hover:border-white/25 hover:bg-white/[0.05]"
                          }`}
                        >
                          <div className="flex items-center gap-1.5">
                            <Clock size={12} className={isSelected ? (direction === "inbound" ? "text-[#ff2e88]" : "text-[#22d3ee]") : "text-[#a7b0c0]"} />
                            {slot}
                          </div>

                          {tooSoon && !isFull && (
                            <span className="text-[9px] font-sans font-normal text-amber-400/80">Too soon</span>
                          )}
                          {isFull && !isWaitlist && (
                            <span className="text-[9px] font-sans font-normal text-red-400/80">Full</span>
                          )}
                          {isWaitlist && (
                            <span className="text-[9px] font-sans font-normal text-amber-400/80">Waitlist</span>
                          )}
                          {trip && !isFull && !tooSoon && (
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

                  {selectedIsToday && (
                    <div className="flex items-start gap-2 py-2 px-3 bg-amber-400/[0.05] border border-amber-400/20 rounded-lg">
                      <AlertCircle size={13} className="text-amber-400 mt-0.5 shrink-0" />
                      <p className="text-[11px] text-amber-300/90 leading-relaxed">
                        Trips must be booked at least <strong className="text-amber-200">2 hours</strong> in advance. Greyed-out slots are no longer available today.
                      </p>
                    </div>
                  )}

                  {trips?.length === 0 && !tripsLoading && (
                    <div className="flex items-center gap-2 py-2 text-[#a7b0c0] text-sm">
                      <Info size={15} />No trips scheduled for this date.
                    </div>
                  )}
                </div>
              )}

              {/* Seat info for selected trip */}
              {matchedTrip && (
                <div className="pt-3 border-t border-white/[0.06]">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-[#a7b0c0]">Seat availability</p>
                    {willBeWaitlisted && (
                      <span className="flex items-center gap-1 text-[10px] text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 rounded-full">
                        <ListOrdered size={10} />Waitlist booking
                      </span>
                    )}
                  </div>
                  <SegmentBar booked={matchedTrip.bookedSeats} total={matchedTrip.totalSeats} min={matchedTrip.minBookingsToConfirm} />
                </div>
              )}
            </div>
          </div>

          {/* Step 2: Map — label adapts to direction */}
          <div className="bg-white/[0.03] border border-[#22d3ee]/20 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/[0.06] flex items-center gap-3">
              <div className="w-6 h-6 rounded-full bg-[#22d3ee]/20 border border-[#22d3ee]/30 flex items-center justify-center text-xs font-bold text-[#22d3ee]">2</div>
              {/* "Get Off Point" for outbound (campus → home), "Pickup" for inbound */}
              <span className="font-semibold text-white text-sm">
                {direction === "outbound" ? "Select Get Off Point on Map" : "Select Pickup on Map"}
              </span>
            </div>

            <div className="px-5 py-3 bg-[#22d3ee]/[0.05] border-b border-[#22d3ee]/10 flex items-start gap-2.5">
              <Navigation size={14} className="text-[#22d3ee] mt-0.5 shrink-0" />
              <p className="text-sm text-[#22d3ee]/90 leading-relaxed">
                {isTerminalSelected
                  ? <>Official <strong className="text-white">Bus Hub</strong> selected — custom on-route stops are disabled for station bookings.</>
                  : <>
                      Tap a <strong className="text-white">terminal marker</strong> for an official bus hub, or click
                      the <strong className="text-white">pink route</strong> for a custom{" "}
                      {direction === "outbound" ? "get-off" : "pickup"} point.
                    </>
                }
              </p>
            </div>

            <div className="rounded-b-xl overflow-hidden">
              {/* When a terminal is selected, onLocationSelect is omitted to disable custom route clicks */}
              <RouteMap
                height="340px"
                showBus={false}
                onLocationSelect={isTerminalSelected ? undefined : handleLocationSelect}
                onTerminalClick={handleTerminalClick}
                selectedCoords={customCoords}
              />
            </div>

            {customCoords && (
              <div className={`px-5 py-3 border-t flex items-center gap-2 ${
                isTerminalSelected
                  ? "border-[#22d3ee]/20 bg-[#22d3ee]/[0.05]"
                  : "border-emerald-400/20 bg-emerald-400/[0.05]"
              }`}>
                <CheckCircle2 size={14} className={isTerminalSelected ? "text-[#22d3ee]" : "text-emerald-400"} />
                <span className={`text-xs font-medium ${isTerminalSelected ? "text-[#22d3ee]" : "text-emerald-300"}`}>
                  {isTerminalSelected
                    ? "Official Bus Hub selected"
                    : `${direction === "outbound" ? "Get Off point" : "Pickup"} confirmed at ${customCoords[0].toFixed(5)}, ${customCoords[1].toFixed(5)}`
                  }
                </span>
                <button
                  onClick={() => { setCustomCoords(null); setIsTerminalSelected(false); }}
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
                  <span className={`text-sm font-medium ${selectedDate ? "text-white" : "text-white/30"}`}>
                    {selectedDate ? format(parseISO(selectedDate), "MMM d, yyyy") : "—"}
                  </span>
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

                {/* Label changes to "Get Off" when student is leaving campus (outbound) */}
                <div className="flex justify-between items-center py-2.5">
                  <span className="text-sm text-[#a7b0c0]">
                    {direction === "outbound" ? "Get Off" : "Pickup"}
                  </span>
                  <span className={`text-sm font-medium text-right max-w-[140px] ${customCoords ? (isTerminalSelected ? "text-[#22d3ee]" : "text-emerald-400") : "text-amber-400/80"}`}>
                    {customCoords
                      ? isTerminalSelected ? "Official Station" : "Custom (on-route)"
                      : "Select on map →"
                    }
                  </span>
                </div>

                {customCoords && (
                  <div className="flex justify-between items-center py-2 bg-emerald-400/[0.05] border border-emerald-400/20 rounded-lg px-3">
                    <span className="text-xs text-[#a7b0c0]">Coords</span>
                    <span className="text-xs font-mono text-emerald-400">{customCoords[0].toFixed(4)}, {customCoords[1].toFixed(4)}</span>
                  </div>
                )}
              </div>

              {/* Waitlist warning */}
              {willBeWaitlisted && selectedTime && (
                <div className="flex items-start gap-2.5 p-3 bg-amber-400/[0.07] border border-amber-400/25 rounded-lg">
                  <ListOrdered size={15} className="text-amber-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-amber-300">This trip is full</p>
                    <p className="text-[11px] text-amber-400/80 mt-0.5 leading-relaxed">
                      You'll be added to the <strong>waiting list</strong>. If someone cancels, you'll be automatically promoted and notified.
                    </p>
                  </div>
                </div>
              )}

              {matchedTrip && !willBeWaitlisted && (
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
                    ? willBeWaitlisted
                      ? "bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-white shadow-lg hover:shadow-[0_0_20px_rgba(245,158,11,0.4)]"
                      : "bg-gradient-to-r from-[#ff2e88] to-[#e0176b] hover:from-[#ff4595] hover:to-[#ff2e88] text-white shadow-lg hover:shadow-[0_0_20px_rgba(255,46,136,0.4)]"
                    : "bg-white/[0.05] text-white/30 cursor-not-allowed"
                }`}
              >
                {createBooking.isPending ? (
                  <><Loader2 size={16} className="animate-spin" />Processing...</>
                ) : willBeWaitlisted ? (
                  <><ListOrdered size={16} />Join Waiting List</>
                ) : (
                  <>Confirm Booking <ChevronRight size={16} /></>
                )}
              </button>

              {!canBook && (
                <p className="text-xs text-center text-[#a7b0c0]">
                  {directionConflict
                    ? "Cancel your existing booking for this direction first"
                    : !selectedTime && !customCoords
                      ? "Pick a direction, time, and your pickup on the map"
                      : !selectedTime
                        ? "Select a departure time above"
                        : "Tap the map route or a terminal to set your pickup"}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
