import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { customFetch } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
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
  Play, Loader2, MapIcon,
} from "lucide-react";

// ─── Driver types (mirrored from driver.tsx) ──────────────────────────────────
interface Passenger {
  bookingId: number;
  studentName: string;
  studentEmail: string;
  studentPhone: string | null;
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
  status: "pending" | "confirmed" | "canceled";
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

  const activeTrip = selectedTripId
    ? trips.find(t => t.id === selectedTripId && t.status === "confirmed") ?? null
    : trips.find(t => t.status === "confirmed") ?? null;

  // Driver-only map data handoff: the Start Trip button passes tripId/date in
  // the URL, then this view fetches that trip and converts every resolvable
  // passenger pickup into the shared RouteMap customBookings prop. Custom
  // pickups use their saved lat/lng, while fixed pickups are translated through
  // the existing pickup point data before RouteMap builds the OSRM route.
  const routeStops: CustomBooking[] = (activeTrip?.passengers ?? [])
    .map(passenger => fixedPickupToRouteStop(passenger, pickupPoints))
    .filter((stop): stop is CustomBooking => stop !== null);

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

  // ── Loading ────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Loader2 size={24} className="text-emerald-400 animate-spin" />
        <p className="text-[#a7b0c0] text-sm">Loading your trips…</p>
      </div>
    );
  }

  // ── No confirmed trip → empty light map ────────────────────────────────────
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

  // ── Confirmed trip → navigation dashboard ──────────────────────────────────
  const totalPassengers = activeTrip.passengers.length;
  const totalStops      = routeStops.length || totalPassengers;

  const stopsDisplay      = isStarted
    ? `${driverStatus.passedStops} / ${driverStatus.totalStops}`
    : `0 / ${totalStops}`;
  const onBoardDisplay    = isStarted
    ? `${driverStatus.passedPassengers} / ${driverStatus.totalPassengers}`
    : `0 / ${totalPassengers}`;
  const routeProgress     = isStarted ? driverStatus.progress : 0;
  const nextStop          = isStarted && driverStatus.nextStopName
    ? driverStatus.nextStopName
    : "42 Irbid Campus";

  return (
    <div className="flex flex-col gap-3">

      {/* ── Stats Panel ───────────────────────────────────────────────────── */}
      <div className="bg-[#090d14] border border-white/[0.08] rounded-2xl p-4 space-y-3">

        {/* Header row */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <span
              className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                isStarted
                  ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)] animate-pulse"
                  : "bg-yellow-400"
              }`}
            />
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
              onClick={() => setIsStarted(true)}
              className="flex items-center gap-2 px-4 py-1.5 rounded-xl text-sm font-semibold
                         bg-emerald-500/15 border border-emerald-500/30 text-emerald-400
                         hover:bg-emerald-500/25 transition-colors"
            >
              <Play size={13} className="fill-emerald-400" />
              Start Navigation
            </button>
          )}
        </div>

        {/* Next Stop */}
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#a7b0c0] mb-1">
            Next Stop
          </p>
          <p className="text-xl font-bold text-white truncate leading-tight">
            {nextStop}
          </p>
        </div>

        {/* Metric cards */}
        <div className="grid grid-cols-3 gap-2">

          {/* Stops Done */}
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#a7b0c0] mb-1">
              Stops Done
            </p>
            <p className="text-xl font-bold text-[#22d3ee] leading-tight">{stopsDisplay}</p>
          </div>

          {/* On Board */}
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#a7b0c0] mb-1">
              On Board
            </p>
            <p className="text-xl font-bold text-[#ff2e88] leading-tight">{onBoardDisplay}</p>
          </div>

          {/* Route % */}
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#a7b0c0] mb-1">
              Route
            </p>
            <p className="text-xl font-bold text-emerald-400 leading-tight">{routeProgress}%</p>
            <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden mt-1.5">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-[#22d3ee] rounded-full transition-all duration-500"
                style={{ width: `${routeProgress}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Map ───────────────────────────────────────────────────────────── */}
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

      {/* Legend hint */}
      <p className="text-xs text-[#a7b0c0] px-1">
        {isStarted
          ? <><span className="text-[#22c55e] font-medium">● Green trace</span> = path travelled · orange markers update as stops are reached</>
          : <><span className="text-emerald-400 font-medium">● Terminal pins</span> = fixed stops · click "Start Navigation" to begin live routing</>
        }
      </p>
    </div>
  );
}

// ─── MapPage (entry point) ─────────────────────────────────────────────────────
export default function MapPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  const [busData, setBusData] = useState({ idx: 0, total: 0, stopIndices: [0, 0, 0, 0] });
  const [customPickup, setCustomPickup] = useState<[number, number] | null>(null);

  useEffect(() => { if (!user) setLocation("/"); }, [user, setLocation]);

  const handleBusMoved = useCallback((idx: number, total: number, stopIndices: number[]) => {
    setBusData({ idx, total, stopIndices });
  }, []);

  const handleLocationSelect = useCallback((coords: [number, number]) => {
    setCustomPickup(coords);
  }, []);

  if (!user) return null;

  // ── Driver: delegate to DriverMapView ──────────────────────────────────────
  if (user.role === "driver") return <DriverMapView />;

  // ── Student: unchanged existing view ──────────────────────────────────────
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
      {/* Header */}
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
