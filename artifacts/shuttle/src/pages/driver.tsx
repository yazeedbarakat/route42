import { useGetDriverTrips } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { format } from "date-fns";
import { Truck, Users, MapPin, Clock, CheckCircle2, Moon } from "lucide-react";

export default function DriverDashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!user) setLocation("/");
    else if (user.role !== "driver") setLocation(user.role === "admin" ? "/admin" : "/dashboard");
  }, [user, setLocation]);

  const { data: trips, isLoading } = useGetDriverTrips();

  if (!user) return null;

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-br from-emerald-400/10 to-emerald-400/5 border border-emerald-400/20 rounded-2xl p-5">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-xl bg-emerald-400/20 flex items-center justify-center">
            <Truck size={20} className="text-emerald-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">Driver Dashboard</h1>
            <p className="text-sm text-[#a7b0c0]">{user.name} · {format(new Date(), "EEEE, MMMM d")}</p>
          </div>
        </div>
      </div>

      {/* Trip list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 gap-3">
          <div className="w-6 h-6 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" />
          <span className="text-[#a7b0c0]">Loading your schedule...</span>
        </div>
      ) : trips?.length === 0 ? (
        <div className="text-center py-16 bg-white/[0.03] border border-white/[0.08] rounded-2xl">
          <div className="w-16 h-16 rounded-full bg-white/[0.05] flex items-center justify-center mx-auto mb-4">
            <Moon size={28} className="text-[#a7b0c0]" />
          </div>
          <p className="text-xl font-bold text-white">No Active Routes</p>
          <p className="text-[#a7b0c0] mt-2">You have no trips scheduled for today.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {trips?.map((trip) => (
            <div key={trip.id} className="bg-white/[0.03] border border-white/[0.08] rounded-2xl overflow-hidden">
              {/* Trip header */}
              <div className="bg-gradient-to-r from-[#ff2e88]/15 to-[#7c3aed]/10 border-b border-white/[0.06] px-5 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Clock size={18} className="text-[#ff2e88]" />
                    <span className="text-2xl font-bold text-white font-mono">{trip.departureTime}</span>
                  </div>
                  <div className="flex items-center gap-2 bg-white/[0.08] border border-white/10 rounded-xl px-4 py-2">
                    <Users size={16} className="text-[#22d3ee]" />
                    <span className="text-xl font-bold font-mono text-white">{trip.totalPassengers}</span>
                    <span className="text-xs text-[#a7b0c0]">PAX</span>
                  </div>
                </div>
              </div>

              {/* Pickup stops */}
              <div className="p-4 space-y-3">
                <p className="text-xs font-semibold text-[#a7b0c0] uppercase tracking-wider mb-3">Pickup Stops</p>
                {trip.pickupStops.map((stop, idx) => (
                  <div key={stop.pickupPointId} className="flex items-center gap-4 p-4 rounded-xl bg-white/[0.04] border border-white/[0.06]">
                    {/* Stop number */}
                    <div className="w-10 h-10 rounded-full bg-[#ff2e88]/10 border border-[#ff2e88]/20 flex items-center justify-center shrink-0">
                      <span className="text-sm font-bold text-[#ff2e88]">{idx + 1}</span>
                    </div>

                    {/* Location */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <MapPin size={14} className="text-[#22d3ee] shrink-0" />
                        <span className="font-semibold text-white text-base truncate">{stop.pickupPointName}</span>
                      </div>
                    </div>

                    {/* Passenger count - large and easy to read */}
                    <div className="shrink-0 text-center min-w-[60px]">
                      <div className="text-3xl font-bold font-mono text-[#22d3ee] leading-none">{stop.passengerCount}</div>
                      <div className="text-xs text-[#a7b0c0] mt-0.5">passengers</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Status footer */}
              <div className="px-5 py-3 border-t border-white/[0.06] flex items-center gap-2">
                <CheckCircle2 size={14} className="text-emerald-400" />
                <span className="text-xs text-emerald-400 font-medium">Trip Confirmed</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
