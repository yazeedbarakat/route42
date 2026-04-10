import { useGetDashboardStats, useGetTripDemand, useConfirmTrip, useCancelTrip, useAddDriver } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { useLocation, Link } from "wouter";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Users, CalendarCheck, Clock, TrendingUp, CheckCircle2, AlertCircle, XCircle, ArrowRight, Loader2, BarChart3, Shield, Map, UserPlus, Hash, Phone } from "lucide-react";
import { RouteMap, type CustomBooking } from "@/components/route-map";

// Demo custom booking coordinates for admin visibility
const ADMIN_CUSTOM_BOOKINGS: CustomBooking[] = [
  { lat: 32.5592, lng: 35.8520, studentName: "Youssef Al-Ahmad"  },
  { lat: 32.5464, lng: 35.8575, studentName: "Sara Mansour"       },
  { lat: 32.5508, lng: 35.8465, studentName: "Omar Khalil"        },
  { lat: 32.5385, lng: 35.8610, studentName: "Layla Hassan"       },
  { lat: 32.5540, lng: 35.8395, studentName: "Ahmad Al-Rashidi"   },
];

function StatCard({ label, value, icon: Icon, color, loading }: {
  label: string; value: string | number | undefined; icon: any; color: string; loading: boolean;
}) {
  const colorMap: Record<string, string> = {
    pink:    "from-[#ff2e88]/20 to-[#ff2e88]/5 border-[#ff2e88]/20 text-[#ff2e88]",
    cyan:    "from-[#22d3ee]/20 to-[#22d3ee]/5 border-[#22d3ee]/20 text-[#22d3ee]",
    emerald: "from-emerald-400/20 to-emerald-400/5 border-emerald-400/20 text-emerald-400",
    amber:   "from-amber-400/20 to-amber-400/5 border-amber-400/20 text-amber-400",
    purple:  "from-purple-400/20 to-purple-400/5 border-purple-400/20 text-purple-400",
    blue:    "from-blue-400/20 to-blue-400/5 border-blue-400/20 text-blue-400",
  };
  const cls = colorMap[color] || colorMap.cyan;
  const [gradientCls, borderCls, textCls] = [
    `bg-gradient-to-br ${cls.split(" ").slice(0, 2).join(" ")}`,
    cls.split(" ")[2],
    cls.split(" ")[3],
  ];
  return (
    <div className={`relative rounded-xl border p-5 overflow-hidden bg-white/[0.02] ${borderCls}`}>
      <div className="flex items-start justify-between mb-4">
        <div className={`w-10 h-10 rounded-xl ${gradientCls} flex items-center justify-center`}>
          <Icon size={18} className={textCls} />
        </div>
      </div>
      <div className={`text-3xl font-bold font-mono mb-1 ${textCls}`}>
        {loading ? <div className="w-12 h-8 bg-white/10 rounded animate-pulse" /> : (value ?? "—")}
      </div>
      <div className="text-xs text-[#a7b0c0] font-medium">{label}</div>
    </div>
  );
}

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

export default function AdminDashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [showCustomMap, setShowCustomMap] = useState(false);

  // ── Driver registration form state ──────────────────────────────────────────
  const [showAddDriver, setShowAddDriver] = useState(false);
  const [driverName, setDriverName]       = useState("");
  const [driverPhone, setDriverPhone]     = useState("");
  const [driverIdInput, setDriverIdInput] = useState("");

  useEffect(() => {
    if (!user) setLocation("/");
    else if (user.role !== "admin") setLocation(user.role === "student" ? "/dashboard" : "/driver");
  }, [user, setLocation]);

  const { data: stats, isLoading: statsLoading } = useGetDashboardStats();
  const { data: demand, isLoading: demandLoading, refetch: refetchDemand } = useGetTripDemand();
  const confirmTrip = useConfirmTrip();
  const cancelTrip  = useCancelTrip();
  const addDriver   = useAddDriver();

  const handleAddDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await addDriver.mutateAsync({
        data: { name: driverName, phone: driverPhone, driverId: driverIdInput },
      });
      toast({
        title: "Driver registered",
        description: `${res.driver.name} can now log in with Driver ID: ${res.driver.driverId}`,
      });
      // Reset form
      setDriverName(""); setDriverPhone(""); setDriverIdInput("");
      setShowAddDriver(false);
    } catch (err: any) {
      const msg = err?.data?.error ?? err?.message ?? "Failed to register driver.";
      toast({ title: "Error", description: msg, variant: "destructive" });
    }
  };

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Shield size={18} className="text-[#ff2e88]" />
            <span className="text-xs font-semibold text-[#ff2e88] uppercase tracking-wider">Admin Panel</span>
          </div>
          <h1 className="text-2xl font-bold text-white">System Overview</h1>
          <p className="text-[#a7b0c0] text-sm mt-0.5">Logged in as {user.name}</p>
        </div>
        <Link href="/admin/bookings">
          <button className="flex items-center gap-2 px-4 py-2 rounded-lg border border-white/[0.1] text-sm text-[#a7b0c0] hover:border-[#ff2e88]/40 hover:text-[#ff2e88] transition-all">
            All Bookings <ArrowRight size={14} />
          </button>
        </Link>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard label="Total Students"   value={stats?.totalStudents}             icon={Users}         color="cyan"    loading={statsLoading} />
        <StatCard label="Bookings Today"   value={stats?.totalBookingsToday}         icon={CalendarCheck} color="pink"    loading={statsLoading} />
        <StatCard label="Confirmed Trips"  value={stats?.confirmedTripsToday}        icon={CheckCircle2}  color="emerald" loading={statsLoading} />
        <StatCard label="Pending Trips"    value={stats?.pendingTripsToday}          icon={Clock}         color="amber"   loading={statsLoading} />
        <StatCard label="Trips This Week"  value={stats?.totalTripsThisWeek}         icon={BarChart3}     color="purple"  loading={statsLoading} />
        <StatCard label="Avg Occupancy"    value={stats?.averageOccupancyRate !== undefined ? `${stats.averageOccupancyRate}%` : undefined} icon={TrendingUp} color="blue" loading={statsLoading} />
      </div>

      {/* Trip demand table */}
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

      {/* ── Register Driver Panel ── */}
      <div className="bg-white/[0.03] border border-[#7c3aed]/20 rounded-xl overflow-hidden">
        <button
          onClick={() => setShowAddDriver(v => !v)}
          className="w-full px-5 py-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#7c3aed]/10 border border-[#7c3aed]/20 flex items-center justify-center">
              <UserPlus size={16} className="text-[#7c3aed]" />
            </div>
            <div className="text-left">
              <p className="font-semibold text-white text-sm">Register New Driver</p>
              <p className="text-xs text-[#a7b0c0]">Create a driver account with a unique Driver ID</p>
            </div>
          </div>
          <span className="text-[#a7b0c0] text-sm">{showAddDriver ? "▲" : "▼"}</span>
        </button>

        {showAddDriver && (
          <form onSubmit={handleAddDriver} className="border-t border-white/[0.06] px-5 py-5 space-y-4">
            <p className="text-xs text-[#a7b0c0] leading-relaxed">
              Drivers created here can sign in using <strong className="text-white">only their Driver ID</strong> — no email or password is needed.
            </p>

            {/* Driver Name */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[#a7b0c0]">Driver Name</label>
              <div className="relative">
                <Users size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a7b0c0]" />
                <input
                  type="text"
                  required
                  value={driverName}
                  onChange={(e) => setDriverName(e.target.value)}
                  className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg pl-9 pr-4 py-2.5 text-white placeholder-[#a7b0c0]/50 text-sm focus:outline-none focus:border-[#7c3aed]/60 focus:bg-white/[0.08] transition-all"
                  placeholder="Full name"
                />
              </div>
            </div>

            {/* Driver Phone */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[#a7b0c0]">Phone Number</label>
              <div className="relative">
                <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a7b0c0]" />
                <input
                  type="tel"
                  required
                  value={driverPhone}
                  onChange={(e) => setDriverPhone(e.target.value)}
                  className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg pl-9 pr-4 py-2.5 text-white placeholder-[#a7b0c0]/50 text-sm focus:outline-none focus:border-[#7c3aed]/60 focus:bg-white/[0.08] transition-all"
                  placeholder="+962 7X XXX XXXX"
                />
              </div>
            </div>

            {/* Unique Driver ID */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[#a7b0c0]">Driver ID <span className="text-[#a7b0c0]/50 font-normal">(must be unique)</span></label>
              <div className="relative">
                <Hash size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a7b0c0]" />
                <input
                  type="text"
                  required
                  value={driverIdInput}
                  onChange={(e) => setDriverIdInput(e.target.value)}
                  className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg pl-9 pr-4 py-2.5 text-white placeholder-[#a7b0c0]/50 text-sm focus:outline-none focus:border-[#7c3aed]/60 focus:bg-white/[0.08] transition-all font-mono tracking-widest"
                  placeholder="e.g. DRV-001"
                />
              </div>
              <p className="text-[11px] text-[#a7b0c0]/70">
                This ID will be shared with the driver so they can sign in.
              </p>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <button
                type="submit"
                disabled={addDriver.isPending}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-sm font-semibold transition-colors disabled:opacity-50"
              >
                {addDriver.isPending ? (
                  <><Loader2 size={14} className="animate-spin" /> Creating...</>
                ) : (
                  <><UserPlus size={14} /> Register Driver</>
                )}
              </button>
              <button
                type="button"
                onClick={() => { setShowAddDriver(false); setDriverName(""); setDriverPhone(""); setDriverIdInput(""); }}
                className="text-sm text-[#a7b0c0] hover:text-white transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
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
              <p className="text-xs text-[#a7b0c0]">{ADMIN_CUSTOM_BOOKINGS.length} students have on-route custom pickups today</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#fb923c] bg-[#fb923c]/10 border border-[#fb923c]/20 px-2.5 py-1 rounded-full font-medium">
              {ADMIN_CUSTOM_BOOKINGS.length} pickups
            </span>
            <span className="text-[#a7b0c0] text-sm">{showCustomMap ? "▲" : "▼"}</span>
          </div>
        </button>

        {showCustomMap && (
          <>
            {/* Passenger summary */}
            <div className="border-t border-white/[0.06] px-5 py-4">
              <p className="text-xs font-semibold text-[#a7b0c0] uppercase tracking-wider mb-3">Students with Custom Pickups</p>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                {ADMIN_CUSTOM_BOOKINGS.map((b, i) => (
                  <div key={i} className="flex items-center gap-2 p-3 rounded-lg bg-[#fb923c]/[0.06] border border-[#fb923c]/15">
                    <div className="w-2 h-2 rounded-full bg-[#fb923c] shadow-[0_0_6px_rgba(251,146,60,0.8)] shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-white leading-tight truncate">{b.studentName}</p>
                      <p className="text-[10px] font-mono text-[#a7b0c0]">{b.lat.toFixed(4)}, {b.lng.toFixed(4)}</p>
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
                customBookings={ADMIN_CUSTOM_BOOKINGS}
              />
            </div>

            <div className="px-5 py-3 border-t border-white/[0.06] bg-[#fb923c]/[0.04] flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-[#fb923c] shadow-[0_0_6px_rgba(251,146,60,0.8)]" />
              <p className="text-xs text-[#a7b0c0]">
                <span className="text-[#fb923c] font-medium">Orange markers</span> = custom student-selected on-route pickups · Click for passenger name
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
