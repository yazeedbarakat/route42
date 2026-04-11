import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { customFetch } from "@workspace/api-client-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  RouteMap,
  TERMINALS,
  DESTINATION,
  type CustomBooking,
  type DriverProgressInfo,
} from "@/components/route-map";
import {
  Bus, Navigation, Clock, Wifi, MapPin, X,
  Play, Loader2, MapIcon, Radio, CheckCircle2,
} from "lucide-react";

// ─── Shared passenger types ───────────────────────────────────────────────────
interface Passenger {
  bookingId: number;
  studentName: string;
  studentEmail: string;
  studentPhone?: string | null;
  pickupType: "fixed" | "custom";
  pickupName: string | null;
  customLat: number | null;
  customLng: number | null;
}

interface DriverTripToday {
  id: number;
  date: string;
  departureTime: string;
  direction: string;
  status: "pending" | "confirmed" | "canceled" | "in_progress";
  bookedSeats: number;
  totalSeats: number;
  minBookingsToConfirm: number;
  passengers: Passenger[];
}

interface PickupPoint {
  id: number;
  name: string;
  lat: number;
  lng: number;
  routeOrder: number;
}

interface ActiveTripResponse {
  status: "not_started" | "in_progress";
  trip?: {
    id: number;
    date: string;
    departureTime: string;
    direction: string;
    passengers: Passenger[];
  };
}

function fixedPickupToRouteStop(passenger: Passenger, pickupPoints: PickupPoint[]): CustomBooking | null {
  if (passenger.pickupType === "custom" && passenger.customLat != null && passenger.customLng != null) {
    return {
      lat: passenger.customLat,
      lng: passenger.customLng,
      studentName: passenger.studentName,
      studentEmail: passenger.studentEmail,
    };
  }

  const normalizedPickup = (passenger.pickupName ?? "").toLowerCase();
  const pickupPoint = pickupPoints.find(p => normalizedPickup.includes(p.name.toLowerCase()));
  const terminal = pickupPoint ?? TERMINALS.find(t =>
    normalizedPickup.includes(t.name.toLowerCase()) ||
    normalizedPickup.includes(t.nameAr.toLowerCase())
  );

  if (!terminal) return null;

  return {
    lat: terminal.lat,
    lng: terminal.lng,
    studentName: passenger.studentName,
    studentEmail: passenger.studentEmail,
  };
}

// ─── DriverMapView ─────────────────────────────────────────────────────────────
function DriverMapView() {
  const params = new URLSearchParams(window.location.search);
  const requestedTripId = Number(params.get("tripId"));
  const selectedTripId = Number.isFinite(requestedTripId) && requestedTripId > 0 ? requestedTripId : null;
  const today = format(new Date(), "yyyy-MM-dd");
  const routeDate = params.get("date") ?? today;
  const shouldAutoStart = params.get("start") === "1";
  const [isStarted, setIsStarted] = useState(shouldAutoStart);
  const [driverStatus, setDriverStatus] = useState({
    nextStopName: "",
    passedStops: 0,
    totalStops: 0,
    passedPassengers: 0,
    totalPassengers: 0,
    progress: 0,
  });

  const { data: trips = [], isLoading } = useQuery<DriverTripToday[]>({
    queryKey: ["driver-trips-map", routeDate],
    queryFn: () => customFetch<DriverTripToday[]>(`/api/driver/trips/today?date=${routeDate}`),
    refetchInterval: 30_000,
  });
  const { data: pickupPoints = [] } = useQuery<PickupPoint[]>({
    queryKey: ["driver-route-pickup-points"],
    queryFn: () => customFetch<PickupPoint[]>("/api/pickup-points"),
  });

  const startTripMutation = useMutation({
    mutationFn: (id: number) =>
      customFetch(`/api/driver/trips/${id}/start`, { method: "POST" }),
  });

  const activeTrip = selectedTripId
    ? trips.find(t => t.id === selectedTripId && t.status !== "canceled") ?? null
    : trips.find(t => t.status === "confirmed" || t.status === "in_progress") ?? null;

  const routeStops: CustomBooking[] = (activeTrip?.passengers ?? [])
    .map(passenger => fixedPickupToRouteStop(passenger, pickupPoints))
    .filter((stop): stop is CustomBooking => stop !== null);

  const handleStartNavigation = useCallback(() => {
    setIsStarted(true);
    if (activeTrip) {
      startTripMutation.mutate(activeTrip.id);
    }
  }, [activeTrip]);

  const handleDriverProgress = useCallback((info: DriverProgressInfo) => {
    setDriverStatus({
      nextStopName: info.nextStopName,
      passedStops: info.passedStops,
      totalStops: info.totalStops,
      passedPassengers: info.passedPassengers,
      totalPassengers: info.totalPassengers,
      progress: info.totalPts > 0 ? Math.round((info.busIdx / info.totalPts) * 100) : 0,
    });
  }, []);

  // Auto-start when navigating from driver dashboard with ?start=1
  useEffect(() => {
    if (shouldAutoStart && activeTrip && !isStarted) {
      handleStartNavigation();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTrip?.id]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Loader2 size={24} className="text-emerald-400 animate-spin" />
        <p className="text-[#a7b0c0] text-sm">Loading your trips…</p>
      </div>
    );
  }

  if (!activeTrip) {
    return (
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Route Map</h1>
          <p className="text-[#a7b0c0] text-sm mt-0.5 flex items-center gap-1.5">
            <MapIcon size={13} className="text-[#a7b0c0]" />
            {selectedTripId ? "Selected trip is unavailable or not confirmed" : "No confirmed trip for this date — map is idle"}
          </p>
        </div>

        <div className="rounded-2xl overflow-hidden border border-white/[0.08] shadow-xl">
          <RouteMap
            height="calc(100vh - 200px)"
            userRole="driver"
            isTripActive={false}
            animateRoute={false}
            showBus={false}
          />
        </div>
      </div>
    );
  }

  const totalPassengers = activeTrip.passengers.length;
  const totalStops      = routeStops.length || totalPassengers;

  const stopsDisplay   = isStarted ? `${driverStatus.passedStops} / ${driverStatus.totalStops}` : `0 / ${totalStops}`;
  const onBoardDisplay = isStarted ? `${driverStatus.passedPassengers} / ${driverStatus.totalPassengers}` : `0 / ${totalPassengers}`;
  const routeProgress  = isStarted ? driverStatus.progress : 0;
  const nextStop       = isStarted && driverStatus.nextStopName ? driverStatus.nextStopName : "42 Irbid Campus";

  return (
    <div className="flex flex-col gap-3">
      {/* ── Stats Panel ── */}
      <div className="bg-[#090d14] border border-white/[0.08] rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${isStarted ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)] animate-pulse" : "bg-yellow-400"}`} />
            <span className="text-sm font-bold tracking-widest text-white uppercase">
              {isStarted ? "Trip Active" : "Ready to Navigate"}
            </span>
            <span className="text-xs text-[#a7b0c0] font-normal ml-1">
              · {activeTrip.direction === "to_campus" ? "→ 42 Irbid" : "← From Campus"}
              {" "}&nbsp;{activeTrip.departureTime}
            </span>
          </div>

          {!isStarted && (
            <button
              onClick={handleStartNavigation}
              className="flex items-center gap-2 px-4 py-1.5 rounded-xl text-sm font-semibold bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25 transition-colors"
            >
              <Play size={13} className="fill-emerald-400" />
              Start Navigation
            </button>
          )}
        </div>

        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#a7b0c0] mb-1">Next Stop</p>
          <p className="text-xl font-bold text-white truncate leading-tight">{nextStop}</p>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#a7b0c0] mb-1">Stops Done</p>
            <p className="text-xl font-bold text-[#22d3ee] leading-tight">{stopsDisplay}</p>
          </div>
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#a7b0c0] mb-1">On Board</p>
            <p className="text-xl font-bold text-[#ff2e88] leading-tight">{onBoardDisplay}</p>
          </div>
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#a7b0c0] mb-1">Route</p>
            <p className="text-xl font-bold text-emerald-400 leading-tight">{routeProgress}%</p>
            <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden mt-1.5">
              <div className="h-full bg-gradient-to-r from-emerald-500 to-[#22d3ee] rounded-full transition-all duration-500" style={{ width: `${routeProgress}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Map ── */}
      <div className="rounded-2xl overflow-hidden border border-white/[0.08] shadow-2xl">
        <RouteMap
          height="calc(100vh - 360px)"
          showBus={false}
          customBookings={routeStops}
          userRole="driver"
          isTripActive={isStarted}
          animateRoute={isStarted}
          onDriverProgress={handleDriverProgress}
        />
      </div>

      <p className="text-xs text-[#a7b0c0] px-1">
        {isStarted
          ? <><span className="text-[#22c55e] font-medium">● Green trace</span> = path travelled · orange markers update as stops are reached</>
          : <><span className="text-emerald-400 font-medium">● Terminal pins</span> = fixed stops · click "Start Navigation" to begin live routing</>
        }
      </p>
    </div>
  );
}

// ─── StudentLiveView — read-only live tracking when trip is in_progress ────────
function StudentLiveView({ trip }: { trip: NonNullable<ActiveTripResponse["trip"]> }) {
  const { data: pickupPoints = [] } = useQuery<PickupPoint[]>({
    queryKey: ["student-live-pickup-points"],
    queryFn: () => customFetch<PickupPoint[]>("/api/pickup-points"),
  });

  const [liveStatus, setLiveStatus] = useState({
    nextStopName: "42 Irbid Campus",
    passedStops: 0,
    totalStops: 0,
    passedPassengers: 0,
    totalPassengers: 0,
    progress: 0,
  });

  const routeStops: CustomBooking[] = trip.passengers
    .map(p => fixedPickupToRouteStop(p, pickupPoints))
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

  return (
    <div className="flex flex-col gap-3">
      {/* Live indicator header */}
      <div className="bg-[#090d14] border border-[#22d3ee]/20 rounded-2xl p-4 space-y-3">
        {/* Status row */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <Radio size={15} className="text-[#22d3ee] animate-pulse" />
            <span className="text-sm font-bold tracking-widest text-white uppercase">Live Tracking</span>
            <span className="ml-1 px-2 py-0.5 text-[10px] font-bold rounded-full bg-[#22d3ee]/15 border border-[#22d3ee]/30 text-[#22d3ee] uppercase tracking-wider">
              In Progress
            </span>
          </div>
          <span className="text-xs text-[#a7b0c0]">
            {trip.direction === "to_campus" ? "→ 42 Irbid" : "← From Campus"} · {trip.departureTime}
          </span>
        </div>

        {/* Next stop */}
        <div className="bg-[#22d3ee]/[0.07] border border-[#22d3ee]/20 rounded-xl px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#a7b0c0] mb-1">Next Stop</p>
          <p className="text-xl font-bold text-white truncate leading-tight">{liveStatus.nextStopName}</p>
        </div>

        {/* Metric cards */}
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

        {/* Read-only notice */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06]">
          <CheckCircle2 size={13} className="text-[#22d3ee] shrink-0" />
          <p className="text-[11px] text-[#a7b0c0]">
            <span className="text-white font-medium">View-only.</span> Your driver has started the trip. Tracking updates in real time.
          </p>
        </div>
      </div>

      {/* Map — read-only live tracking: light theme, no click events, no pickup pin */}
      <div className="rounded-2xl overflow-hidden border border-[#22d3ee]/20 shadow-2xl">
        <RouteMap
          height="calc(100vh - 420px)"
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
    </div>
  );
}

// ─── StudentMapView — standard dark map or live tracking ──────────────────────
function StudentMapView() {
  const [busData, setBusData] = useState({ idx: 0, total: 0, stopIndices: [0, 0, 0, 0] });
  const [customPickup, setCustomPickup] = useState<[number, number] | null>(null);

  const { data: activeTripData, isLoading: loadingActive } = useQuery<ActiveTripResponse>({
    queryKey: ["student-active-trip"],
    queryFn: () => customFetch<ActiveTripResponse>("/api/student/active-trip"),
    refetchInterval: 15_000,
    staleTime: 10_000,
  });

  const handleBusMoved = useCallback((idx: number, total: number, stopIndices: number[]) => {
    setBusData({ idx, total, stopIndices });
  }, []);

  const handleLocationSelect = useCallback((coords: [number, number]) => {
    setCustomPickup(coords);
  }, []);

  if (loadingActive) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Loader2 size={24} className="text-[#22d3ee] animate-spin" />
        <p className="text-[#a7b0c0] text-sm">Checking trip status…</p>
      </div>
    );
  }

  // ── Active trip: switch to live tracking mode ──
  if (activeTripData?.status === "in_progress" && activeTripData.trip) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold text-white">Live Route Map</h1>
            <p className="text-[#a7b0c0] text-sm mt-0.5 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#22d3ee] inline-block animate-pulse" />
              Irbid, Jordan · Trip in progress
            </p>
          </div>
          <div className="sm:ml-auto flex items-center gap-2 px-3 py-1.5 bg-[#22d3ee]/10 border border-[#22d3ee]/20 rounded-lg">
            <Radio size={13} className="text-[#22d3ee] animate-pulse" />
            <span className="text-xs text-[#22d3ee] font-medium">Live</span>
          </div>
        </div>
        <StudentLiveView trip={activeTripData.trip} />
      </div>
    );
  }

  // ── No active trip: standard dark map ──────────────────────────────────────
  const { idx, total, stopIndices } = busData;
  const busProgress = total > 0 ? Math.round((idx / total) * 100) : 0;

  const liveEtas = TERMINALS.map((_, i) => {
    if (total === 0) return "—";
    let away = (stopIndices[i] ?? 0) - idx;
    if (away < 0) away += total;
    return Math.max(1, Math.round((away / total) * 22));
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Live Route Map</h1>
          <p className="text-[#a7b0c0] text-sm mt-0.5 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-pulse" />
            Irbid, Jordan · OSRM real road routing
          </p>
        </div>
        <div className="sm:ml-auto flex items-center gap-2 px-3 py-1.5 bg-emerald-400/10 border border-emerald-400/20 rounded-lg">
          <Wifi size={13} className="text-emerald-400" />
          <span className="text-xs text-emerald-400 font-medium">Live</span>
        </div>
      </div>

      <div className="grid lg:grid-cols-4 gap-4">
        {/* Map */}
        <div className="lg:col-span-3 rounded-2xl overflow-hidden border border-white/[0.08] shadow-2xl">
          <RouteMap
            height="520px"
            showBus
            onBusMoved={handleBusMoved}
            onLocationSelect={handleLocationSelect}
            selectedCoords={customPickup}
          />
        </div>

        {/* Side panel */}
        <div className="lg:col-span-1 flex flex-col gap-3">
          {/* Bus progress */}
          <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Bus size={15} className="text-[#ff2e88]" />
              <span className="text-sm font-semibold text-white">Bus Status</span>
              <span className="ml-auto text-[10px] text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full">OSRM</span>
            </div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-[#a7b0c0]">Route progress</span>
              <span className="text-xs font-mono text-[#ff2e88] font-bold">{busProgress}%</span>
            </div>
            <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#ff2e88] to-[#7c3aed] rounded-full transition-all duration-300"
                style={{ width: `${busProgress}%` }}
              />
            </div>
          </div>

          {/* Stop ETAs */}
          <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl overflow-hidden flex-1">
            <div className="px-4 py-3 border-b border-white/[0.06] flex items-center gap-2">
              <Navigation size={14} className="text-[#22d3ee]" />
              <span className="text-sm font-semibold text-white">Stop ETAs</span>
            </div>
            <div className="divide-y divide-white/[0.05]">
              {TERMINALS.map((t, i) => (
                <div key={t.id} className="px-4 py-3 flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-[#22d3ee] mt-1.5 shrink-0 shadow-[0_0_6px_rgba(34,211,238,0.8)]" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-white truncate">{t.name}</div>
                    <div className="text-[10px] text-[#a7b0c0] mt-0.5">{t.nameAr}</div>
                  </div>
                  <div className="shrink-0 flex items-center gap-1">
                    <Clock size={10} className="text-[#ff2e88]" />
                    <span className="text-xs font-mono font-bold text-[#ff2e88]">{liveEtas[i]}m</span>
                  </div>
                </div>
              ))}
              <div className="px-4 py-3 flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-[#ff2e88] mt-1.5 shrink-0 shadow-[0_0_6px_rgba(255,46,136,0.8)]" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-white">{DESTINATION.name}</div>
                  <div className="text-[10px] text-[#a7b0c0] mt-0.5">Final Destination</div>
                </div>
                <span className="text-[10px] text-[#a7b0c0] bg-white/[0.05] px-2 py-0.5 rounded-full shrink-0">dest.</span>
              </div>
            </div>
          </div>

          {/* Custom pickup card */}
          <div className={`bg-white/[0.03] border rounded-xl p-4 transition-colors ${customPickup ? "border-emerald-500/30" : "border-white/[0.08]"}`}>
            <div className="flex items-center gap-2 mb-2">
              <MapPin size={14} className={customPickup ? "text-emerald-400" : "text-[#a7b0c0]"} />
              <span className="text-sm font-semibold text-white">Custom Pickup</span>
              {customPickup && (
                <button
                  onClick={() => setCustomPickup(null)}
                  className="ml-auto p-1 rounded-md hover:bg-white/10 text-[#a7b0c0] hover:text-white transition-colors"
                >
                  <X size={12} />
                </button>
              )}
            </div>
            {customPickup ? (
              <>
                <p className="text-[10px] font-mono text-emerald-400 mb-1">
                  {customPickup[0].toFixed(5)}, {customPickup[1].toFixed(5)}
                </p>
                <p className="text-[10px] text-[#a7b0c0]">On-route · Approved</p>
              </>
            ) : (
              <p className="text-[10px] text-[#a7b0c0] leading-relaxed">
                Click anywhere <strong className="text-white">on the pink route</strong> to request a custom pickup.
              </p>
            )}
          </div>

          {/* Legend */}
          <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-4">
            <p className="text-xs font-semibold text-[#a7b0c0] mb-3 uppercase tracking-wider">Legend</p>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-[#a7b0c0]">
                <div className="w-3 h-3 rounded-full bg-[#22d3ee] shadow-[0_0_6px_rgba(34,211,238,0.8)]" />Pickup Terminal
              </div>
              <div className="flex items-center gap-2 text-xs text-[#a7b0c0]">
                <div className="w-3 h-3 rounded-full bg-[#ff2e88] shadow-[0_0_6px_rgba(255,46,136,0.8)]" />42 Irbid Destination
              </div>
              <div className="flex items-center gap-2 text-xs text-[#a7b0c0]">
                <div className="w-3 h-3 rounded-full bg-[#34d399] shadow-[0_0_6px_rgba(52,211,153,0.8)]" />Custom Pickup
              </div>
              <div className="flex items-center gap-2 text-xs text-[#a7b0c0]">
                <div className="w-10 h-0.5" style={{ backgroundImage: "repeating-linear-gradient(90deg,#ff2e88 0,#ff2e88 6px,transparent 6px,transparent 10px)" }} />Real Road Route
              </div>
              <div className="flex items-center gap-2 text-xs text-[#a7b0c0]">
                <span className="text-base leading-none">🚌</span>Live Bus (OSRM)
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── MapPage (entry point) ─────────────────────────────────────────────────────
export default function MapPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!user) { setLocation("/"); return; }
    if (user.role === "student") setLocation("/dashboard");
  }, [user, setLocation]);

  if (!user || user.role === "student") return null;

  if (user.role === "driver") return <DriverMapView />;

  return <StudentMapView />;
}
