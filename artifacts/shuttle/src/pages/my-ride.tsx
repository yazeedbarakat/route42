import { useState, useCallback, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { useLocation, Link } from "wouter";
import { customFetch } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import {
  RouteMap,
  TERMINALS,
  type CustomBooking,
  type DriverProgressInfo,
} from "@/components/route-map";
import {
  Bus, Radio, Clock, MapPin, CalendarDays, Navigation,
  User, Hash, ArrowRight, CheckCircle2, Loader2, Ticket,
  Phone, AlertCircle,
} from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────────────────────
interface Passenger {
  bookingId: number;
  studentName: string;
  studentEmail: string;
  pickupType: "fixed" | "custom";
  pickupName: string | null;
  customLat: number | null;
  customLng: number | null;
}

interface MyRideResponse {
  status: "none" | "confirmed" | "in_progress";
  booking?: {
    id: number;
    pickupType: "fixed" | "custom";
    pickupName: string | null;
    customLat: number | null;
    customLng: number | null;
  };
  trip?: {
    id: number;
    date: string;
    departureTime: string;
    direction: string;
    totalSeats: number;
    bookedSeats: number;
  };
  driver?: {
    name: string;
    driverId: string | null;
    phone: string | null;
  } | null;
  passengers?: Passenger[];
}

// ─── Helpers ───────────────────────────────────────────────────────────────────
function resolvePassengerStop(p: Passenger): CustomBooking | null {
  if (p.pickupType === "custom" && p.customLat != null && p.customLng != null) {
    return { lat: p.customLat, lng: p.customLng, studentName: p.studentName, studentEmail: p.studentEmail };
  }
  const name = (p.pickupName ?? "").toLowerCase();
  const terminal = TERMINALS.find(t =>
    name.includes(t.name.toLowerCase()) || name.includes(t.nameAr.toLowerCase())
  );
  if (!terminal) return null;
  return { lat: terminal.lat, lng: terminal.lng, studentName: p.studentName, studentEmail: p.studentEmail };
}

function directionLabel(dir: string) {
  return dir === "to_campus" || dir === "to_school" ? "→ 42 Irbid Campus" : "← From Campus";
}

// ─── Empty State ───────────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div className="w-20 h-20 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center mb-5">
        <Bus size={36} className="text-[#a7b0c0]" />
      </div>
      <h2 className="text-xl font-bold text-white mb-2">No Active Ride</h2>
      <p className="text-[#a7b0c0] text-sm max-w-sm leading-relaxed mb-6">
        You don't have any active rides at the moment. Head over to the Bookings page to reserve your seat!
      </p>
      <Link href="/book">
        <button className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#ff2e88]/15 border border-[#ff2e88]/30 text-[#ff2e88] text-sm font-semibold hover:bg-[#ff2e88]/25 transition-colors">
          Book a Ride <ArrowRight size={14} />
        </button>
      </Link>
    </div>
  );
}

// ─── Digital Ticket ────────────────────────────────────────────────────────────
function DigitalTicket({ bookingId, status }: { bookingId: number; status: "confirmed" | "in_progress" }) {
  const isLive = status === "in_progress";
  return (
    <div className={`rounded-xl border p-4 ${isLive ? "bg-[#22d3ee]/[0.05] border-[#22d3ee]/20" : "bg-white/[0.03] border-white/[0.08]"}`}>
      <div className="flex items-center gap-2 mb-3">
        <Ticket size={15} className={isLive ? "text-[#22d3ee]" : "text-[#a7b0c0]"} />
        <span className="text-xs font-semibold uppercase tracking-wider text-[#a7b0c0]">Digital Ticket</span>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <p className="text-[10px] text-[#a7b0c0] mb-0.5">Booking ID</p>
          <p className="text-2xl font-bold font-mono text-white">#{String(bookingId).padStart(5, "0")}</p>
        </div>
        <div className="w-14 h-14 rounded-lg bg-white flex items-center justify-center">
          <div className="grid grid-cols-3 gap-0.5">
            {Array.from({ length: 9 }).map((_, i) => (
              <div
                key={i}
                className="w-3.5 h-3.5 rounded-[2px]"
                style={{ backgroundColor: Math.random() > 0.4 ? "#0a0e17" : "#fff" }}
              />
            ))}
          </div>
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-white/[0.06] flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${isLive ? "bg-[#22d3ee] animate-pulse" : "bg-amber-400"}`} />
        <span className="text-xs text-[#a7b0c0]">
          {isLive ? "Trip in progress — show this to board" : "Present this ticket at your pickup point"}
        </span>
      </div>
    </div>
  );
}

// ─── Confirmed / Waiting View ──────────────────────────────────────────────────
function ConfirmedView({ data }: { data: Required<Pick<MyRideResponse, "booking" | "trip" | "driver">> & { status: "confirmed" } }) {
  const { booking, trip, driver } = data;

  const pickupDisplay = booking.pickupType === "custom"
    ? `Custom Location (${booking.customLat?.toFixed(4)}, ${booking.customLng?.toFixed(4)})`
    : booking.pickupName ?? "—";

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">My Ride</h1>
          <p className="text-[#a7b0c0] text-sm mt-0.5">Your trip is confirmed and ready to go.</p>
        </div>
        <div className="sm:ml-auto flex items-center gap-2 px-3 py-1.5 bg-amber-400/10 border border-amber-400/20 rounded-lg">
          <Clock size={13} className="text-amber-400" />
          <span className="text-xs text-amber-400 font-semibold">Waiting for Departure</span>
        </div>
      </div>

      {/* Status banner */}
      <div className="bg-[#090d14] border border-amber-400/20 rounded-2xl p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-400/10 flex items-center justify-center shrink-0">
            <Bus size={20} className="text-amber-400" />
          </div>
          <div>
            <p className="text-sm font-bold text-white">Waiting for departure</p>
            <p className="text-xs text-[#a7b0c0] mt-0.5">
              Your bus departs at <span className="text-amber-400 font-semibold">{trip.departureTime}</span> · {directionLabel(trip.direction)}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-1.5 px-2.5 py-1 bg-amber-400/10 border border-amber-400/20 rounded-full">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Confirmed</span>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Ride Details */}
        <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#a7b0c0]">Ride Details</p>

          <div className="space-y-2.5">
            <div className="flex items-center gap-3">
              <Clock size={14} className="text-[#ff2e88] shrink-0" />
              <div>
                <p className="text-[10px] text-[#a7b0c0]">Departure</p>
                <p className="text-sm font-semibold text-white font-mono">{trip.departureTime}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <CalendarDays size={14} className="text-[#22d3ee] shrink-0" />
              <div>
                <p className="text-[10px] text-[#a7b0c0]">Date</p>
                <p className="text-sm font-semibold text-white">{trip.date}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Navigation size={14} className="text-[#7c3aed] shrink-0" />
              <div>
                <p className="text-[10px] text-[#a7b0c0]">Destination</p>
                <p className="text-sm font-semibold text-white">{directionLabel(trip.direction)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <MapPin size={14} className="text-emerald-400 shrink-0" />
              <div>
                <p className="text-[10px] text-[#a7b0c0]">Pickup</p>
                <p className="text-sm font-semibold text-white truncate">{pickupDisplay}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Driver Info */}
        <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#a7b0c0]">Driver</p>
          {driver ? (
            <div className="space-y-2.5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-emerald-400/10 border border-emerald-400/20 flex items-center justify-center shrink-0">
                  <User size={16} className="text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{driver.name}</p>
                  {driver.driverId && (
                    <p className="text-[10px] text-[#a7b0c0]">ID: {driver.driverId}</p>
                  )}
                </div>
              </div>
              {driver.phone && (
                <div className="flex items-center gap-3">
                  <Phone size={14} className="text-[#a7b0c0] shrink-0" />
                  <p className="text-sm text-[#a7b0c0]">{driver.phone}</p>
                </div>
              )}
              <div className="flex items-center gap-2 px-3 py-2 bg-emerald-400/[0.06] border border-emerald-400/15 rounded-lg">
                <Bus size={13} className="text-emerald-400 shrink-0" />
                <p className="text-xs text-[#a7b0c0]">42 Transportation Shuttle Bus</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-[#a7b0c0]">
              <AlertCircle size={14} />
              <span className="text-xs">Driver info unavailable</span>
            </div>
          )}
        </div>
      </div>

      {/* Digital Ticket */}
      <DigitalTicket bookingId={booking.id} status="confirmed" />
    </div>
  );
}

// ─── Live / In-Progress View ───────────────────────────────────────────────────
function LiveView({ data }: { data: Required<Pick<MyRideResponse, "booking" | "trip" | "driver" | "passengers">> & { status: "in_progress" } }) {
  const { booking, trip, driver, passengers } = data;

  const [liveStatus, setLiveStatus] = useState({
    nextStopName: "42 Irbid Campus",
    passedStops: 0,
    totalStops: 0,
    passedPassengers: 0,
    totalPassengers: 0,
    progress: 0,
  });

  const routeStops: CustomBooking[] = (passengers as Passenger[])
    .map(resolvePassengerStop)
    .filter((s): s is CustomBooking => s !== null);

  const handleProgress = useCallback((info: DriverProgressInfo) => {
    setLiveStatus({
      nextStopName: info.nextStopName,
      passedStops: info.passedStops,
      totalStops: info.totalStops,
      passedPassengers: info.passedPassengers,
      totalPassengers: info.totalPassengers,
      progress: info.totalPts > 0 ? Math.round((info.busIdx / info.totalPts) * 100) : 0,
    });
  }, []);

  const pickupDisplay = booking.pickupType === "custom"
    ? `Custom (${booking.customLat?.toFixed(4)}, ${booking.customLng?.toFixed(4)})`
    : booking.pickupName ?? "—";

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">My Ride</h1>
          <p className="text-[#a7b0c0] text-sm mt-0.5 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#22d3ee] inline-block animate-pulse" />
            Live tracking active · {directionLabel(trip.direction)}
          </p>
        </div>
        <div className="sm:ml-auto flex items-center gap-2 px-3 py-1.5 bg-[#22d3ee]/10 border border-[#22d3ee]/20 rounded-lg">
          <Radio size={13} className="text-[#22d3ee] animate-pulse" />
          <span className="text-xs text-[#22d3ee] font-semibold">On the way!</span>
        </div>
      </div>

      {/* Live Stats */}
      <div className="bg-[#090d14] border border-[#22d3ee]/20 rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <Radio size={15} className="text-[#22d3ee] animate-pulse" />
            <span className="text-sm font-bold tracking-widest text-white uppercase">Live Tracking</span>
            <span className="ml-1 px-2 py-0.5 text-[10px] font-bold rounded-full bg-[#22d3ee]/15 border border-[#22d3ee]/30 text-[#22d3ee] uppercase tracking-wider">
              In Progress
            </span>
          </div>
          <span className="text-xs text-[#a7b0c0]">{trip.departureTime} · {trip.date}</span>
        </div>

        <div className="bg-[#22d3ee]/[0.07] border border-[#22d3ee]/20 rounded-xl px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#a7b0c0] mb-1">Next Stop</p>
          <p className="text-xl font-bold text-white truncate leading-tight">{liveStatus.nextStopName}</p>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#a7b0c0] mb-1">Stops Done</p>
            <p className="text-xl font-bold text-[#22d3ee] leading-tight">
              {liveStatus.passedStops}<span className="text-xs font-normal text-[#a7b0c0]">/{liveStatus.totalStops}</span>
            </p>
          </div>
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#a7b0c0] mb-1">On Board</p>
            <p className="text-xl font-bold text-[#ff2e88] leading-tight">
              {liveStatus.passedPassengers}<span className="text-xs font-normal text-[#a7b0c0]">/{liveStatus.totalPassengers}</span>
            </p>
          </div>
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#a7b0c0] mb-1">Route</p>
            <p className="text-xl font-bold text-emerald-400 leading-tight">{liveStatus.progress}%</p>
            <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden mt-1.5">
              <div
                className="h-full bg-gradient-to-r from-[#22d3ee] to-emerald-400 rounded-full transition-all duration-500"
                style={{ width: `${liveStatus.progress}%` }}
              />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06]">
          <CheckCircle2 size={13} className="text-[#22d3ee] shrink-0" />
          <p className="text-[11px] text-[#a7b0c0]">
            <span className="text-white font-medium">View-only.</span> Your driver has started the trip. Tracking updates in real time.
          </p>
        </div>
      </div>

      {/* Live Map */}
      <div className="rounded-2xl overflow-hidden border border-[#22d3ee]/20 shadow-2xl">
        <RouteMap
          height="420px"
          showBus={false}
          customBookings={routeStops}
          userRole="driver"
          isTripActive={true}
          animateRoute={true}
          onDriverProgress={handleProgress}
          isReadOnly={true}
          forceLightTheme={true}
        />
      </div>

      <p className="text-xs text-[#a7b0c0] px-1">
        <span className="text-[#22c55e] font-medium">● Green trace</span> = path travelled · bus icon shows current position
      </p>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Ride Details */}
        <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-4 space-y-2.5">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#a7b0c0]">Ride Details</p>
          <div className="flex items-center gap-3">
            <MapPin size={14} className="text-emerald-400 shrink-0" />
            <div>
              <p className="text-[10px] text-[#a7b0c0]">Your Pickup</p>
              <p className="text-sm font-semibold text-white truncate">{pickupDisplay}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Navigation size={14} className="text-[#7c3aed] shrink-0" />
            <div>
              <p className="text-[10px] text-[#a7b0c0]">Destination</p>
              <p className="text-sm font-semibold text-white">{directionLabel(trip.direction)}</p>
            </div>
          </div>
          {driver && (
            <div className="flex items-center gap-3">
              <User size={14} className="text-[#a7b0c0] shrink-0" />
              <div>
                <p className="text-[10px] text-[#a7b0c0]">Driver</p>
                <p className="text-sm font-semibold text-white">{driver.name}</p>
              </div>
            </div>
          )}
        </div>

        {/* Digital Ticket */}
        <DigitalTicket bookingId={booking.id} status="in_progress" />
      </div>
    </div>
  );
}

// ─── MyRide Page ───────────────────────────────────────────────────────────────
export default function MyRide() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!user) { setLocation("/"); return; }
    if (user.role !== "student") setLocation(user.role === "admin" ? "/admin" : "/driver");
  }, [user, setLocation]);

  const { data, isLoading } = useQuery<MyRideResponse>({
    queryKey: ["student-my-ride"],
    queryFn: () => customFetch<MyRideResponse>("/api/student/my-ride"),
    refetchInterval: 10_000,
    staleTime: 8_000,
    enabled: !!user && user.role === "student",
  });

  if (!user || user.role !== "student") return null;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Loader2 size={24} className="text-[#22d3ee] animate-spin" />
        <p className="text-[#a7b0c0] text-sm">Loading your ride info…</p>
      </div>
    );
  }

  if (!data || data.status === "none") {
    return <EmptyState />;
  }

  if (data.status === "confirmed" && data.booking && data.trip) {
    return (
      <ConfirmedView
        data={{
          status: "confirmed",
          booking: data.booking,
          trip: data.trip,
          driver: data.driver ?? null,
        }}
      />
    );
  }

  if (data.status === "in_progress" && data.booking && data.trip) {
    return (
      <LiveView
        data={{
          status: "in_progress",
          booking: data.booking,
          trip: data.trip,
          driver: data.driver ?? null,
          passengers: data.passengers ?? [],
        }}
      />
    );
  }

  return <EmptyState />;
}
