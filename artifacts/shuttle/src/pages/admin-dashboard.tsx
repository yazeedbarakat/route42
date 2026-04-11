import {
  useGetDashboardStats, useGetTripDemand, useConfirmTrip, useCancelTrip,
  useGetCustomPickupsHistory, type StatCardKey,
} from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { useLocation, Link } from "wouter";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import {
  Users, CalendarCheck, Clock, TrendingUp, CheckCircle2, AlertCircle,
  XCircle, ArrowRight, Loader2, BarChart3, Shield, Map, ChevronRight,
} from "lucide-react";
import { RouteMap } from "@/components/route-map";
import { StatDetailsModal } from "@/components/stat-details-modal";

// ─── StatCard ─────────────────────────────────────────────────────────────────
function StatCard({
  label, value, icon: Icon, color, loading, onClick,
}: {
  label: string;
  value: string | number | undefined;
  icon: any;
  color: string;
  loading: boolean;
  onClick?: () => void;
}) {
  const colorMap: Record<string, string> = {
    pink:    "from-[#ff2e88]/20 to-[#ff2e88]/5 border-[#ff2e88]/20 text-[#ff2e88] shadow-[#ff2e88]",
    cyan:    "from-[#22d3ee]/20 to-[#22d3ee]/5 border-[#22d3ee]/20 text-[#22d3ee] shadow-[#22d3ee]",
    emerald: "from-emerald-400/20 to-emerald-400/5 border-emerald-400/20 text-emerald-400 shadow-emerald-400",
    amber:   "from-amber-400/20 to-amber-400/5 border-amber-400/20 text-amber-400 shadow-amber-400",
    purple:  "from-purple-400/20 to-purple-400/5 border-purple-400/20 text-purple-400 shadow-purple-400",
    blue:    "from-blue-400/20 to-blue-400/5 border-blue-400/20 text-blue-400 shadow-blue-400",
  };
  const cls = colorMap[color] || colorMap.cyan;
  const parts = cls.split(" ");
  const gradientCls = `bg-gradient-to-br ${parts[0]} ${parts[1]}`;
  const borderCls   = parts[2];
  const textCls     = parts[3];

  return (
    <div
      onClick={onClick}
      className={`
        group relative rounded-xl border p-5 overflow-hidden bg-white/[0.02] ${borderCls}
        transition-all duration-200
        ${onClick ? "cursor-pointer hover:scale-[1.02] hover:bg-white/[0.04] hover:shadow-lg active:scale-[0.99]" : ""}
      `}
      style={onClick ? { transition: "transform 0.15s, box-shadow 0.15s, background 0.15s" } : undefined}
    >
      <div className="flex items-start justify-between mb-4">
        <div className={`w-10 h-10 rounded-xl ${gradientCls} flex items-center justify-center`}>
          <Icon size={18} className={textCls} />
        </div>
        {onClick && (
          <ChevronRight
            size={14}
            className={`${textCls} opacity-0 group-hover:opacity-60 transition-opacity -mt-0.5 -mr-0.5`}
          />
        )}
      </div>
      <div className={`text-3xl font-bold font-mono mb-1 ${textCls}`}>
        {loading
          ? <div className="w-12 h-8 bg-white/10 rounded animate-pulse" />
          : (value ?? "—")}
      </div>
      <div className="text-xs text-[#a7b0c0] font-medium">{label}</div>

      {/* Hover glow line at bottom */}
      {onClick && (
        <div className={`absolute bottom-0 left-0 right-0 h-px ${textCls} opacity-0 group-hover:opacity-30 transition-opacity bg-current`} />
      )}
    </div>
  );
}

// ─── TripStatusBadge ──────────────────────────────────────────────────────────
function TripStatusBadge({ status }: { status: string }) {
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

// ─── AdminDashboard ───────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [showCustomMap, setShowCustomMap] = useState(false);
  const [activeCard, setActiveCard] = useState<StatCardKey | null>(null);

  useEffect(() => {
    if (!user) setLocation("/");
    else if (user.role !== "admin") setLocation(user.role === "student" ? "/dashboard" : "/driver");
  }, [user, setLocation]);

  const { data: stats, isLoading: statsLoading } = useGetDashboardStats();
  const { data: demand, isLoading: demandLoading, refetch: refetchDemand } = useGetTripDemand();
  const { data: hotspots = [], isLoading: hotspotsLoading } = useGetCustomPickupsHistory({
    query: { enabled: user?.role === "admin" },
  });
  const confirmTrip = useConfirmTrip();
  const cancelTrip  = useCancelTrip();

  const handleConfirm = async (id: number) => {
    try {
      await confirmTrip.mutateAsync({ id });
      toast({ title: "Trip confirmed", description: "Trip has been manually confirmed." });
      refetchDemand();
    } catch (err: any) {
      toast({ title: "Error", description: err?.message, variant: "destructive" });
    }
  };

  const handleCancel = async (id: number) => {
    if (!confirm("Cancel this trip? All bookings will be affected.")) return;
    try {
      await cancelTrip.mutateAsync({ id });
      toast({ title: "Trip cancelled", description: "Trip has been cancelled." });
      refetchDemand();
    } catch (err: any) {
      toast({ title: "Error", description: err?.message, variant: "destructive" });
    }
  };

  if (!user) return null;

  const tripsWithDemand = demand ?? [];
  const peakTrip = tripsWithDemand.reduce<typeof tripsWithDemand[number] | null>(
    (peak, trip) => (!peak || trip.bookingCount > peak.bookingCount ? trip : peak),
    null,
  );
  const totalBookedSeats = tripsWithDemand.reduce((sum, trip) => sum + trip.bookingCount, 0);
  const totalSeats = tripsWithDemand.reduce((sum, trip) => sum + trip.bookingCount + trip.availableSeats, 0);
  const efficiency = totalSeats > 0 ? Math.round((totalBookedSeats / totalSeats) * 100) : 0;
  const totalCustomPickups = hotspots.reduce((sum, h) => sum + h.totalUsage, 0);

  return (
    <div className="space-y-6">
      {/* ── Drill-Down Modal ── */}
      <StatDetailsModal card={activeCard} onClose={() => setActiveCard(null)} />

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Shield size={18} className="text-[#ff2e88]" />
            <span className="text-xs font-semibold text-[#ff2e88] uppercase tracking-wider">Admin Panel</span>
          </div>
          <h1 className="text-2xl font-bold text-white">System Overview</h1>
          <p className="text-[#a7b0c0] text-sm mt-0.5">Logged in as {user.name}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-[#a7b0c0] hidden sm:block">
            Click any card to drill down
          </span>
          <Link href="/admin/bookings">
            <button className="flex items-center gap-2 px-4 py-2 rounded-lg border border-white/[0.1] text-sm text-[#a7b0c0] hover:border-[#ff2e88]/40 hover:text-[#ff2e88] transition-all">
              All Bookings <ArrowRight size={14} />
            </button>
          </Link>
        </div>
      </div>

      {/* ── Stats grid — all 8 cards clickable ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Students"  value={stats?.totalStudents}             icon={Users}         color="cyan"    loading={statsLoading} onClick={() => setActiveCard("totalStudents")}  />
        <StatCard label="Bookings Today"  value={stats?.totalBookingsToday}         icon={CalendarCheck} color="pink"    loading={statsLoading} onClick={() => setActiveCard("bookingsToday")}  />
        <StatCard label="Confirmed Trips" value={stats?.confirmedTripsToday}        icon={CheckCircle2}  color="emerald" loading={statsLoading} onClick={() => setActiveCard("confirmedTrips")} />
        <StatCard label="Pending Trips"   value={stats?.pendingTripsToday}          icon={Clock}         color="amber"   loading={statsLoading} onClick={() => setActiveCard("pendingTrips")}   />
        <StatCard label="Trips This Week" value={stats?.totalTripsThisWeek}         icon={BarChart3}     color="purple"  loading={statsLoading} onClick={() => setActiveCard("tripsThisWeek")}  />
        <StatCard
          label="Avg Occupancy"
          value={stats?.averageOccupancyRate !== undefined ? `${stats.averageOccupancyRate}%` : undefined}
          icon={TrendingUp} color="blue" loading={statsLoading}
          onClick={() => setActiveCard("avgOccupancy")}
        />
        <StatCard label="Peak Time"  value={peakTrip ? peakTrip.departureTime : "—"} icon={Clock}      color="amber"   loading={demandLoading} onClick={() => setActiveCard("peakTime")}   />
        <StatCard label="Efficiency" value={`${efficiency}%`}                         icon={TrendingUp} color="emerald" loading={demandLoading} onClick={() => setActiveCard("efficiency")} />
      </div>

      {/* ── Trip demand table ── */}
      <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 size={16} className="text-[#ff2e88]" />
            <h2 className="font-semibold text-white text-sm">Trip Demand Analysis</h2>
          </div>
          <span className="text-xs text-[#a7b0c0]">{demand?.length || 0} trips</span>
        </div>

        {demandLoading ? (
          <div className="flex items-center gap-3 p-6">
            <Loader2 size={18} className="animate-spin text-[#ff2e88]" />
            <span className="text-[#a7b0c0] text-sm">Loading trip data...</span>
          </div>
        ) : demand?.length === 0 ? (
          <div className="text-center py-12 text-[#a7b0c0] text-sm">No active trips found.</div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    {["Trip ID", "Departure", "Demand", "Confirmed", "Status", "Actions"].map(h => (
                      <th key={h} className="text-left px-5 py-3 text-xs font-medium text-[#a7b0c0] uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {demand?.map((trip, idx) => {
                    const fillPct = Math.min(((trip.bookingCount) / (trip.bookingCount + trip.availableSeats)) * 100, 100);
                    return (
                      <tr key={trip.tripId} className={`${idx !== demand.length - 1 ? "border-b border-white/[0.04]" : ""} hover:bg-white/[0.02] transition-colors`}>
                        <td className="px-5 py-4 font-mono text-xs text-[#a7b0c0]">#{trip.tripId}</td>
                        <td className="px-5 py-4">
                          <span className="font-mono font-semibold text-white">{trip.departureTime}</span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-20 h-1.5 bg-white/10 rounded-full overflow-hidden">
                              <div className="h-full bg-gradient-to-r from-[#ff2e88] to-[#ff2e88]/60 rounded-full" style={{ width: `${fillPct}%` }} />
                            </div>
                            <span className="text-xs font-mono text-white">{trip.bookingCount}</span>
                          </div>
                        </td>
                        <td className="px-5 py-4"><span className="text-sm font-mono text-emerald-400">{trip.confirmedCount}</span></td>
                        <td className="px-5 py-4"><TripStatusBadge status={trip.status} /></td>
                        <td className="px-5 py-4">
                          {trip.status === "pending" && (
                            <div className="flex items-center gap-2">
                              <button onClick={() => handleConfirm(trip.tripId)} className="text-xs px-3 py-1.5 rounded-lg bg-emerald-400/10 text-emerald-400 border border-emerald-400/20 hover:bg-emerald-400/20 transition-colors">Confirm</button>
                              <button onClick={() => handleCancel(trip.tripId)} className="text-xs px-3 py-1.5 rounded-lg bg-red-400/10 text-red-400 border border-red-400/20 hover:bg-red-400/20 transition-colors">Cancel</button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-white/[0.06]">
              {demand?.map((trip) => {
                const fillPct = Math.min(((trip.bookingCount) / (trip.bookingCount + trip.availableSeats)) * 100, 100);
                return (
                  <div key={trip.tripId} className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-white text-lg">{trip.departureTime}</span>
                      <TripStatusBadge status={trip.status} />
                    </div>
                    <div>
                      <div className="flex justify-between text-xs text-[#a7b0c0] mb-1">
                        <span>{trip.bookingCount} booked</span><span>{trip.availableSeats} available</span>
                      </div>
                      <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full bg-[#ff2e88] rounded-full" style={{ width: `${fillPct}%` }} />
                      </div>
                    </div>
                    {trip.status === "pending" && (
                      <div className="flex gap-2 pt-1">
                        <button onClick={() => handleConfirm(trip.tripId)} className="flex-1 py-2 rounded-lg text-xs font-medium bg-emerald-400/10 text-emerald-400 border border-emerald-400/20">Confirm Trip</button>
                        <button onClick={() => handleCancel(trip.tripId)} className="flex-1 py-2 rounded-lg text-xs font-medium bg-red-400/10 text-red-400 border border-red-400/20">Cancel Trip</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* ── Custom Pickup Map Panel ── */}
      <div className="bg-white/[0.03] border border-[#fb923c]/20 rounded-xl overflow-hidden">
        <button
          onClick={() => setShowCustomMap(v => !v)}
          className="w-full px-5 py-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#fb923c]/10 border border-[#fb923c]/20 flex items-center justify-center">
              <Map size={16} className="text-[#fb923c]" />
            </div>
            <div className="text-left">
              <p className="font-semibold text-white text-sm">Custom Pickup Map</p>
              <p className="text-xs text-[#a7b0c0]">
                {hotspotsLoading
                  ? "Loading analytics data…"
                  : `${hotspots.length} hotspot${hotspots.length !== 1 ? "s" : ""} · ${totalCustomPickups} total custom pickups`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {hotspotsLoading ? (
              <Loader2 size={14} className="animate-spin text-[#fb923c]" />
            ) : (
              <span className="text-xs text-[#fb923c] bg-[#fb923c]/10 border border-[#fb923c]/20 px-2.5 py-1 rounded-full font-medium">
                {hotspots.length} hotspot{hotspots.length !== 1 ? "s" : ""}
              </span>
            )}
            <span className="text-[#a7b0c0] text-sm">{showCustomMap ? "▲" : "▼"}</span>
          </div>
        </button>

        {showCustomMap && (
          <>
            {hotspotsLoading ? (
              <div className="border-t border-white/[0.06] flex items-center gap-3 px-5 py-8">
                <Loader2 size={18} className="animate-spin text-[#fb923c]" />
                <span className="text-[#a7b0c0] text-sm">Aggregating pickup data…</span>
              </div>
            ) : hotspots.length === 0 ? (
              <div className="border-t border-white/[0.06] text-center py-12 text-[#a7b0c0] text-sm">
                No custom pickup bookings found in the database yet.
              </div>
            ) : (
              <>
                {/* Hotspot summary */}
                <div className="border-t border-white/[0.06] px-5 py-4">
                  <p className="text-xs font-semibold text-[#a7b0c0] uppercase tracking-wider mb-3">
                    Pickup Hotspots · 50m Radius Clusters
                  </p>
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                    {hotspots.map((h, i) => (
                      <div key={i} className="flex items-center gap-2 p-3 rounded-lg bg-[#fb923c]/[0.06] border border-[#fb923c]/15">
                        <div
                          className="shrink-0 rounded-full bg-[#fb923c] flex items-center justify-center font-bold text-white text-[10px]"
                          style={{
                            width: `${Math.round(18 + (h.totalUsage / Math.max(...hotspots.map(x => x.totalUsage), 1)) * 12)}px`,
                            height: `${Math.round(18 + (h.totalUsage / Math.max(...hotspots.map(x => x.totalUsage), 1)) * 12)}px`,
                            boxShadow: "0 0 8px rgba(251,146,60,0.7)",
                          }}
                        >
                          {h.totalUsage}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-white leading-tight">
                            {h.totalUsage} pickup{h.totalUsage !== 1 ? "s" : ""}
                          </p>
                          <p className="text-[10px] font-mono text-[#a7b0c0] truncate">
                            {h.coordinates.lat.toFixed(4)}, {h.coordinates.lng.toFixed(4)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Map */}
                <div className="border-t border-white/[0.06]">
                  <RouteMap
                    height="420px"
                    showBus={false}
                    analyticsHotspots={hotspots}
                  />
                </div>

                <div className="px-5 py-3 border-t border-white/[0.06] bg-[#fb923c]/[0.04] flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-[#fb923c] shadow-[0_0_6px_rgba(251,146,60,0.8)]" />
                  <p className="text-xs text-[#a7b0c0]">
                    <span className="text-[#fb923c] font-medium">Orange markers</span> = clustered pickup hotspots (50m radius) · Larger = more usage · Click for full analytics
                  </p>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
