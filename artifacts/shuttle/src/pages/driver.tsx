import { customFetch } from "@workspace/api-client-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { useEffect, useState, useCallback } from "react";
import { format, addDays } from "date-fns";
import {
  Truck, Users, MapPin, Clock, Moon, Map,
  CheckCircle2, XCircle, ChevronDown, ChevronUp,
  UserCheck, AlertTriangle, Navigation, RefreshCw,
  Phone, Play, BarChart3, Zap, TrendingUp, CalendarDays,
} from "lucide-react";
import { RouteMap, type CustomBooking, type DriverProgressInfo } from "@/components/route-map";

// ─── Types ────────────────────────────────────────────────────────────────────
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

// ─── Date helpers ──────────────────────────────────────────────────────────────
function getDateOptions() {
  const today = new Date();
  return [0, 1, 2].map(offset => {
    const d = addDays(today, offset);
    return {
      iso: format(d, "yyyy-MM-dd"),
      label: offset === 0 ? "Today" : offset === 1 ? "Tomorrow" : "Day After",
      display: format(d, "EEE, MMM d"),
    };
  });
}

// ─── API helpers ──────────────────────────────────────────────────────────────
const fetchTripsForDate = (date: string) =>
  customFetch<DriverTripToday[]>(`/api/driver/trips/today?date=${date}`);

const acceptTrip = (id: number) =>
  customFetch(`/api/driver/trips/${id}/accept`, { method: "POST" });

const cancelTrip = (id: number) =>
  customFetch(`/api/driver/trips/${id}/cancel`, { method: "POST" });

// ─── Sub-components ───────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    confirmed: { label: "Confirmed", color: "#34d399", bg: "rgba(52,211,153,.12)" },
    pending:   { label: "Pending",   color: "#facc15", bg: "rgba(250,204,21,.12)" },
    canceled:  { label: "Canceled",  color: "#f87171", bg: "rgba(248,113,113,.12)" },
  };
  const s = map[status] ?? map.pending;
  return (
    <span
      className="text-xs font-semibold px-2.5 py-1 rounded-full border"
      style={{ color: s.color, background: s.bg, borderColor: `${s.color}44` }}
    >
      {s.label}
    </span>
  );
}

function DirectionBadge({ direction }: { direction: string }) {
  const inbound = direction === "to_school";
  return (
    <span className="flex items-center gap-1.5 text-xs font-medium text-[#22d3ee] bg-[#22d3ee]/10 border border-[#22d3ee]/20 px-2.5 py-1 rounded-full">
      <Navigation size={11} />
      {inbound ? "→ 42 Irbid" : "← From Campus"}
    </span>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  color: string;
}) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl border p-4 flex flex-col gap-2"
      style={{
        background: `linear-gradient(135deg, ${color}12 0%, transparent 60%)`,
        borderColor: `${color}28`,
        boxShadow: `0 0 20px ${color}0a`,
      }}
    >
      <div className="flex items-center gap-2">
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: `${color}20`, boxShadow: `0 0 10px ${color}40` }}
        >
          <Icon size={15} style={{ color }} />
        </div>
        <span className="text-xs text-[#a7b0c0] font-medium">{label}</span>
      </div>
      <p className="text-2xl font-bold text-white font-mono leading-none">{value}</p>
      {sub && <p className="text-[11px] text-[#a7b0c0]">{sub}</p>}
    </div>
  );
}

function DailyStats({ trips }: { trips: DriverTripToday[] }) {
  const active = trips.filter(t => t.status !== "canceled");
  const tripsWithPassengers = active.filter(t => t.passengers.length > 0);
  const totalPassengers = tripsWithPassengers.reduce((s, t) => s + t.passengers.length, 0);
  const totalSeats = tripsWithPassengers.length * 15;
  const efficiency = totalSeats > 0 ? Math.round((totalPassengers / totalSeats) * 100) : 0;

  let peakTime = "—";
  let peakCount = 0;
  for (const t of tripsWithPassengers) {
    if (t.passengers.length > peakCount) {
      peakCount = t.passengers.length;
      peakTime = t.departureTime;
    }
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <BarChart3 size={15} className="text-[#ff2e88]" />
        <h2 className="text-sm font-bold text-white tracking-wide uppercase">Daily Overview</h2>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <StatCard icon={Truck}       label="Total Trips"       value={tripsWithPassengers.length} sub="with bookings" color="#22d3ee" />
        <StatCard icon={Users}       label="Total Passengers"  value={totalPassengers}             sub="across all trips" color="#ff2e88" />
        <StatCard icon={Clock}       label="Peak Time"         value={peakTime}                    sub={peakCount > 0 ? `${peakCount} passengers` : "no data"} color="#facc15" />
        <StatCard icon={TrendingUp}  label="Efficiency"        value={`${efficiency}%`}            sub="seats filled" color="#34d399" />
      </div>
    </div>
  );
}

function TripCard({
  trip,
  isStarted,
  onStartTrip,
}: {
  trip: DriverTripToday;
  isStarted: boolean;
  onStartTrip: (id: number) => void;
}) {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [driverStatus, setDriverStatus] = useState<{
    nextStopName: string;
    nextStopOrder: number;
    passedStops: number;
    totalStops: number;
    passedPassengers: number;
    totalPassengers: number;
    progress: number;
  } | null>(null);

  const handleDriverProgress = useCallback((info: DriverProgressInfo) => {
    setDriverStatus({
      nextStopName:      info.nextStopName,
      nextStopOrder:     info.nextStopOrder,
      passedStops:       info.passedStops,
      totalStops:        info.totalStops,
      passedPassengers:  info.passedPassengers,
      totalPassengers:   info.totalPassengers,
      progress:          info.totalPts > 0 ? Math.round((info.busIdx / info.totalPts) * 100) : 0,
    });
  }, []);

  const acceptMut = useMutation({
    mutationFn: () => acceptTrip(trip.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["driver", "trips"] }),
  });

  const cancelMut = useMutation({
    mutationFn: () => cancelTrip(trip.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["driver", "trips"] }),
  });

  const customMarkers: CustomBooking[] = trip.passengers
    .filter(p => p.pickupType === "custom" && p.customLat != null && p.customLng != null)
    .map(p => ({
      lat: p.customLat!,
      lng: p.customLng!,
      studentName: p.studentName,
      studentEmail: p.studentEmail,
    }));

  const isBusy = acceptMut.isPending || cancelMut.isPending;
  const isCanceled = trip.status === "canceled";
  const hasPassengers = trip.passengers.length > 0;

  return (
    <div
      className={`border rounded-2xl overflow-hidden transition-all ${
        isCanceled
          ? "opacity-50 border-white/[0.06] bg-white/[0.02]"
          : isStarted
          ? "border-[#22d3ee]/30 bg-[#22d3ee]/[0.04] shadow-[0_0_24px_rgba(34,211,238,0.08)]"
          : "border-white/[0.08] bg-white/[0.03]"
      }`}
    >
      {/* ── Trip header ── */}
      <div className="bg-gradient-to-r from-[#ff2e88]/15 to-[#7c3aed]/10 border-b border-white/[0.06] px-5 py-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <Clock size={18} className="text-[#ff2e88] shrink-0" />
            <span className="text-2xl font-bold text-white font-mono">{trip.departureTime}</span>
            <DirectionBadge direction={trip.direction} />
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 bg-white/[0.08] border border-white/10 rounded-xl px-3 py-1.5">
              <Users size={14} className="text-[#22d3ee]" />
              <span className="text-lg font-bold font-mono text-white">{trip.passengers.length}</span>
              <span className="text-xs text-[#a7b0c0]">/ {trip.totalSeats}</span>
            </div>
            <StatusBadge status={trip.status} />
          </div>
        </div>
      </div>

      {/* ── Trip controls ── */}
      {!isCanceled && (
        <div className="px-5 py-3 border-b border-white/[0.06] flex items-center gap-2 flex-wrap">
          {trip.status === "pending" && (
            <button
              onClick={() => acceptMut.mutate()}
              disabled={isBusy || !hasPassengers}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <UserCheck size={15} />
              {acceptMut.isPending ? "Accepting…" : "Accept Trip"}
            </button>
          )}

          {trip.status === "confirmed" && (
            <button
              onClick={() => onStartTrip(trip.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                isStarted
                  ? "bg-[#22d3ee]/20 border border-[#22d3ee]/50 text-[#22d3ee] shadow-[0_0_12px_rgba(34,211,238,0.3)]"
                  : "bg-[#22d3ee]/10 border border-[#22d3ee]/25 text-[#22d3ee] hover:bg-[#22d3ee]/20"
              }`}
            >
              <Play size={14} className={isStarted ? "fill-[#22d3ee]" : ""} />
              {isStarted ? "Trip Active" : "Start Trip"}
            </button>
          )}

          <button
            onClick={() => cancelMut.mutate()}
            disabled={isBusy}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-red-500/10 border border-red-500/25 text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <XCircle size={15} />
            {cancelMut.isPending ? "Canceling…" : "Cancel Trip"}
          </button>

          {trip.status === "pending" && trip.passengers.length < trip.minBookingsToConfirm && (
            <span className="flex items-center gap-1.5 text-xs text-[#facc15] ml-auto">
              <AlertTriangle size={12} />
              {trip.minBookingsToConfirm - trip.passengers.length} more needed for auto-confirm
            </span>
          )}
        </div>
      )}

      {/* ── Passenger manifest toggle ── */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full px-5 py-3 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <Users size={15} className="text-[#22d3ee]" />
          Passenger Manifest
          <span className="text-xs text-[#a7b0c0] font-normal">({trip.passengers.length} booked)</span>
        </div>
        {expanded ? <ChevronUp size={16} className="text-[#a7b0c0]" /> : <ChevronDown size={16} className="text-[#a7b0c0]" />}
      </button>

      {/* ── Manifest table ── */}
      {expanded && (
        <div className="border-t border-white/[0.06]">
          {trip.passengers.length === 0 ? (
            <p className="text-center text-[#a7b0c0] text-sm py-6">No passengers booked yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wider text-[#a7b0c0] bg-white/[0.02]">
                    <th className="text-left px-5 py-2.5 font-semibold">#</th>
                    <th className="text-left px-3 py-2.5 font-semibold">Student</th>
                    <th className="text-left px-3 py-2.5 font-semibold">Pickup</th>
                    <th className="text-left px-3 py-2.5 font-semibold">Contact</th>
                  </tr>
                </thead>
                <tbody>
                  {trip.passengers.map((p, i) => (
                    <tr key={p.bookingId} className="border-t border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                      <td className="px-5 py-3 text-[#a7b0c0] font-mono text-xs">{i + 1}</td>
                      <td className="px-3 py-3">
                        <p className="font-semibold text-white leading-tight">{p.studentName}</p>
                        <p className="text-[11px] text-[#a7b0c0] mt-0.5 truncate max-w-[140px]">{p.studentEmail}</p>
                      </td>
                      <td className="px-3 py-3">
                        {p.pickupType === "custom" ? (
                          <span className="flex items-center gap-1.5 text-xs text-[#fb923c]">
                            <span className="w-2 h-2 rounded-full bg-[#fb923c] shadow-[0_0_6px_rgba(251,146,60,0.8)] shrink-0" />
                            {p.pickupName ?? "Custom Pickup"}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5 text-xs text-[#22d3ee]">
                            <MapPin size={11} className="shrink-0" />
                            {p.pickupName ?? "—"}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {p.studentPhone ? (
                          <a
                            href={`tel:${p.studentPhone}`}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#ff2e88]/10 border border-[#ff2e88]/25 text-[#ff2e88] hover:bg-[#ff2e88]/20 transition-colors"
                          >
                            <Phone size={11} />
                            {p.studentPhone}
                          </a>
                        ) : (
                          <span className="text-xs text-[#a7b0c0]/50 italic">No phone</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Custom pickup map ── */}
      {customMarkers.length > 0 && (
        <div className="border-t border-white/[0.06]">
          <button
            onClick={() => setShowMap(v => !v)}
            className="w-full px-5 py-3 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
          >
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Map size={15} className="text-[#fb923c]" />
              Custom Pickup Map
              <span className="text-xs bg-[#fb923c]/15 border border-[#fb923c]/25 text-[#fb923c] px-2 py-0.5 rounded-full font-medium">
                {customMarkers.length} on-route
              </span>
            </div>
            {showMap ? <ChevronUp size={16} className="text-[#a7b0c0]" /> : <ChevronDown size={16} className="text-[#a7b0c0]" />}
          </button>

          {showMap && (
            <>
              {/* ── Driver Status Panel ── */}
              {isStarted && driverStatus ? (
                <div className="border-t border-white/[0.06] bg-gradient-to-r from-[#22d3ee]/[0.06] to-[#22c55e]/[0.04] px-5 py-4">
                  {/* Next stop banner */}
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2 h-2 rounded-full bg-[#22c55e] shadow-[0_0_8px_rgba(34,197,94,0.9)] animate-pulse shrink-0" />
                    <span className="text-[11px] font-bold uppercase tracking-widest text-[#22c55e]">Trip Active</span>
                  </div>
                  <div className="bg-[#22d3ee]/[0.08] border border-[#22d3ee]/20 rounded-xl px-4 py-3 mb-3">
                    <p className="text-[10px] text-[#a7b0c0] uppercase tracking-wider mb-0.5">Next Stop</p>
                    <p className="text-lg font-bold text-white leading-tight">{driverStatus.nextStopName}</p>
                  </div>
                  {/* Counters row */}
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <div className="bg-white/[0.04] rounded-lg px-3 py-2 text-center border border-white/[0.06]">
                      <p className="text-[10px] text-[#a7b0c0] leading-none mb-1">Stops Done</p>
                      <p className="text-base font-bold font-mono text-[#22d3ee]">{driverStatus.passedStops}<span className="text-xs text-[#a7b0c0] font-normal">/{driverStatus.totalStops}</span></p>
                    </div>
                    <div className="bg-white/[0.04] rounded-lg px-3 py-2 text-center border border-white/[0.06]">
                      <p className="text-[10px] text-[#a7b0c0] leading-none mb-1">On Board</p>
                      <p className="text-base font-bold font-mono text-[#ff2e88]">{driverStatus.passedPassengers}<span className="text-xs text-[#a7b0c0] font-normal">/{driverStatus.totalPassengers}</span></p>
                    </div>
                    <div className="bg-white/[0.04] rounded-lg px-3 py-2 text-center border border-white/[0.06]">
                      <p className="text-[10px] text-[#a7b0c0] leading-none mb-1">Route</p>
                      <p className="text-base font-bold font-mono text-[#facc15]">{driverStatus.progress}%</p>
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div className="w-full h-1.5 bg-white/[0.08] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${driverStatus.progress}%`,
                        background: "linear-gradient(90deg, #22d3ee, #22c55e)",
                        boxShadow: "0 0 8px rgba(34,211,238,0.6)",
                      }}
                    />
                  </div>
                </div>
              ) : isStarted ? (
                <div className="border-t border-white/[0.06] px-5 py-3 flex items-center gap-2">
                  <div className="w-3 h-3 border-2 border-[#22d3ee]/40 border-t-[#22d3ee] rounded-full animate-spin" />
                  <span className="text-xs text-[#22d3ee]">Loading route…</span>
                </div>
              ) : (
                <div className="border-t border-white/[0.06] px-5 py-3 grid grid-cols-2 gap-2">
                  {customMarkers.map((b, i) => (
                    <div key={i} className="flex items-center gap-2 p-2.5 rounded-lg bg-[#fb923c]/[0.06] border border-[#fb923c]/15">
                      <div className="w-2 h-2 rounded-full bg-[#fb923c] shadow-[0_0_6px_rgba(251,146,60,0.8)] shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-white leading-tight truncate">{b.studentName}</p>
                        <p className="text-[10px] font-mono text-[#a7b0c0]">{b.lat.toFixed(4)}, {b.lng.toFixed(4)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* ── Map ── */}
              <div className="border-t border-white/[0.06]">
                <RouteMap
                  height="400px"
                  showBus={false}
                  customBookings={customMarkers}
                  userRole="driver"
                  isTripActive={isStarted}
                  animateRoute={isStarted}
                  onDriverProgress={handleDriverProgress}
                />
              </div>
              <div className="px-5 py-2.5 border-t border-white/[0.06] bg-[#fb923c]/[0.03]">
                <p className="text-xs text-[#a7b0c0]">
                  {isStarted
                    ? <><span className="text-[#22c55e] font-medium">🟢 Animated route</span> · green trace = path travelled · markers update as stops are reached</>
                    : <><span className="text-[#fb923c] font-medium">🟠 Numbered stops</span> = farthest-first order · click "Start Trip" to begin navigation animation</>
                  }
                </p>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main dashboard ───────────────────────────────────────────────────────────
export default function DriverDashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const dateOptions = getDateOptions();
  const [selectedDateIdx, setSelectedDateIdx] = useState(0);
  const [activeTrip, setActiveTrip] = useState<number | null>(null);

  const selectedDate = dateOptions[selectedDateIdx];

  useEffect(() => {
    if (!user) setLocation("/");
    else if (user.role !== "driver") setLocation(user.role === "admin" ? "/admin" : "/dashboard");
  }, [user, setLocation]);

  const { data: trips, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["driver", "trips", selectedDate.iso],
    queryFn: () => fetchTripsForDate(selectedDate.iso),
    enabled: !!user,
    refetchInterval: selectedDateIdx === 0 ? 15_000 : false,
  });

  if (!user) return null;

  const activeTrips = trips?.filter(t => t.status !== "canceled" && t.passengers.length > 0) ?? [];
  const allTrips = trips ?? [];
  const canceledTrips = trips?.filter(t => t.status === "canceled") ?? [];

  const handleStartTrip = (id: number) => {
    setActiveTrip(prev => (prev === id ? null : id));
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* ── Header ── */}
      <div className="bg-gradient-to-br from-emerald-400/10 to-emerald-400/5 border border-emerald-400/20 rounded-2xl p-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-400/20 flex items-center justify-center shrink-0">
            <Truck size={20} className="text-emerald-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-white">Driver Dashboard</h1>
            <p className="text-sm text-[#a7b0c0]">{user.name}</p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {trips && (
              <div className="text-right">
                <p className="text-2xl font-bold font-mono text-white">{activeTrips.length}</p>
                <p className="text-xs text-[#a7b0c0]">active trips</p>
              </div>
            )}
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              title="Refresh live data"
              className="w-9 h-9 rounded-xl bg-[#22d3ee]/10 border border-[#22d3ee]/25 flex items-center justify-center text-[#22d3ee] hover:bg-[#22d3ee]/20 transition-colors disabled:opacity-50"
            >
              <RefreshCw size={15} className={isFetching ? "animate-spin" : ""} />
            </button>
          </div>
        </div>
      </div>

      {/* ── 3-Day Date Selector ── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <CalendarDays size={15} className="text-[#ff2e88]" />
          <h2 className="text-sm font-bold text-white tracking-wide uppercase">Schedule</h2>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {dateOptions.map((opt, idx) => (
            <button
              key={opt.iso}
              onClick={() => { setSelectedDateIdx(idx); setActiveTrip(null); }}
              className={`flex flex-col items-center gap-0.5 px-3 py-3 rounded-2xl border text-sm font-semibold transition-all ${
                selectedDateIdx === idx
                  ? "bg-[#ff2e88]/15 border-[#ff2e88]/40 text-[#ff2e88] shadow-[0_0_16px_rgba(255,46,136,0.2)]"
                  : "bg-white/[0.03] border-white/[0.08] text-[#a7b0c0] hover:bg-white/[0.06] hover:text-white"
              }`}
            >
              <span className={`text-base font-bold ${selectedDateIdx === idx ? "text-[#ff2e88]" : "text-white"}`}>
                {opt.label}
              </span>
              <span className="text-[11px] font-normal">{opt.display}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Loading / Error states ── */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 gap-3">
          <div className="w-6 h-6 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" />
          <span className="text-[#a7b0c0]">Loading schedule…</span>
        </div>
      ) : error ? (
        <div className="text-center py-12 bg-red-500/10 border border-red-500/20 rounded-2xl">
          <AlertTriangle size={28} className="mx-auto mb-3 text-red-400" />
          <p className="text-white font-semibold">Could not load trips</p>
          <p className="text-[#a7b0c0] text-sm mt-1">Please refresh the page.</p>
        </div>
      ) : (
        <>
          {/* ── Daily Stats ── */}
          {allTrips.length > 0 && <DailyStats trips={allTrips} />}

          {/* ── Legend ── */}
          <div className="flex items-center gap-4 text-xs text-[#a7b0c0] px-1 flex-wrap">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#facc15]" /> Pending (can accept or cancel)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400" /> Confirmed (cancel if emergency)
            </span>
            <span className="flex items-center gap-1.5">
              <Zap size={10} className="text-[#22d3ee]" /> Start Trip to highlight route on map
            </span>
          </div>

          {/* ── Trip List ── */}
          {activeTrips.length === 0 ? (
            <div className="text-center py-16 bg-white/[0.03] border border-white/[0.08] rounded-2xl">
              <div className="w-16 h-16 rounded-full bg-white/[0.05] flex items-center justify-center mx-auto mb-4">
                <Moon size={28} className="text-[#a7b0c0]" />
              </div>
              <p className="text-xl font-bold text-white">No Active Trips</p>
              <p className="text-[#a7b0c0] mt-2 max-w-xs mx-auto text-sm">
                No trips with passengers scheduled for {selectedDate.display}.
              </p>
              <button
                onClick={() => refetch()}
                disabled={isFetching}
                className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-[#22d3ee]/10 border border-[#22d3ee]/25 text-[#22d3ee] hover:bg-[#22d3ee]/20 transition-colors disabled:opacity-50"
              >
                <RefreshCw size={13} className={isFetching ? "animate-spin" : ""} />
                Check for new bookings
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              {activeTrips.map(trip => (
                <TripCard
                  key={trip.id}
                  trip={trip}
                  isStarted={activeTrip === trip.id}
                  onStartTrip={handleStartTrip}
                />
              ))}
            </div>
          )}

          {/* ── Canceled trips ── */}
          {canceledTrips.length > 0 && (
            <details className="bg-white/[0.02] border border-white/[0.06] rounded-2xl overflow-hidden">
              <summary className="px-5 py-3 flex items-center gap-2 cursor-pointer text-sm text-[#a7b0c0] select-none">
                <XCircle size={14} className="text-red-400/60" />
                {canceledTrips.length} canceled trip{canceledTrips.length > 1 ? "s" : ""} for {selectedDate.display} (hidden)
              </summary>
              <div className="p-4 space-y-4">
                {canceledTrips.map(trip => (
                  <TripCard
                    key={trip.id}
                    trip={trip}
                    isStarted={false}
                    onStartTrip={() => {}}
                  />
                ))}
              </div>
            </details>
          )}

          {/* ── Auto-refresh note ── */}
          {selectedDateIdx === 0 ? (
            <p className="text-center text-xs text-[#a7b0c0]/60">
              <CheckCircle2 size={11} className="inline mr-1" />
              Auto-refreshes every 15 s · or use the ↻ button for instant update
            </p>
          ) : (
            <p className="text-center text-xs text-[#a7b0c0]/60">
              Viewing {selectedDate.display} schedule · use ↻ to refresh
            </p>
          )}
        </>
      )}
    </div>
  );
}
