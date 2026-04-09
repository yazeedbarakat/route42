import { useGetDashboardStats, useGetTripDemand, useConfirmTrip, useCancelTrip } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { useLocation, Link } from "wouter";
import { useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

export default function AdminDashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    if (!user) setLocation("/");
    else if (user.role !== "admin") setLocation(user.role === "student" ? "/dashboard" : "/driver");
  }, [user, setLocation]);

  const { data: stats, isLoading: statsLoading } = useGetDashboardStats();
  const { data: demand, isLoading: demandLoading, refetch: refetchDemand } = useGetTripDemand();

  const confirmTrip = useConfirmTrip();
  const cancelTrip = useCancelTrip();

  const handleConfirmTrip = async (id: number) => {
    try {
      await confirmTrip.mutateAsync({ id });
      toast({ title: "SYSTEM", description: "TRIP_CONFIRMED_SUCCESSFULLY" });
      refetchDemand();
    } catch (err: any) {
      toast({ title: "ERR_CONFIRM_FAILED", description: err?.message || "TRANSACTION_FAILED", variant: "destructive" });
    }
  };

  const handleCancelTrip = async (id: number) => {
    if (!confirm("ARE_YOU_SURE_YOU_WANT_TO_CANCEL_THIS_TRIP?")) return;
    try {
      await cancelTrip.mutateAsync({ id });
      toast({ title: "SYSTEM", description: "TRIP_CANCELED_SUCCESSFULLY" });
      refetchDemand();
    } catch (err: any) {
      toast({ title: "ERR_CANCEL_FAILED", description: err?.message || "TRANSACTION_FAILED", variant: "destructive" });
    }
  };

  if (!user) return null;

  return (
    <div className="space-y-6">
      <div className="border border-border p-4 bg-card">
        <h1 className="text-xl font-bold text-primary mb-2">{">"} SYSTEM_ADMINISTRATION</h1>
        <div className="text-sm text-muted-foreground">
          USER: {user.name} | ACCESS_LEVEL: ROOT
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="border border-border p-4">
          <div className="text-xs text-muted-foreground mb-2">TOTAL_STUDENTS</div>
          <div className="text-2xl font-bold text-secondary">{statsLoading ? "..." : stats?.totalStudents}</div>
        </div>
        <div className="border border-border p-4">
          <div className="text-xs text-muted-foreground mb-2">BOOKINGS_TODAY</div>
          <div className="text-2xl font-bold text-primary">{statsLoading ? "..." : stats?.totalBookingsToday}</div>
        </div>
        <div className="border border-border p-4">
          <div className="text-xs text-muted-foreground mb-2">CONFIRMED_TRIPS_TODAY</div>
          <div className="text-2xl font-bold text-primary">{statsLoading ? "..." : stats?.confirmedTripsToday}</div>
        </div>
        <div className="border border-border p-4">
          <div className="text-xs text-muted-foreground mb-2">PENDING_TRIPS_TODAY</div>
          <div className="text-2xl font-bold text-yellow-500">{statsLoading ? "..." : stats?.pendingTripsToday}</div>
        </div>
        <div className="border border-border p-4">
          <div className="text-xs text-muted-foreground mb-2">TRIPS_THIS_WEEK</div>
          <div className="text-2xl font-bold">{statsLoading ? "..." : stats?.totalTripsThisWeek}</div>
        </div>
        <div className="border border-border p-4">
          <div className="text-xs text-muted-foreground mb-2">AVG_OCCUPANCY</div>
          <div className="text-2xl font-bold text-secondary">{statsLoading ? "..." : `${stats?.averageOccupancyRate}%`}</div>
        </div>
      </div>

      <div className="border border-border p-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold">{">"} TRIP_DEMAND_ANALYSIS</h2>
          <Link href="/admin/bookings" className="text-sm text-primary hover:underline border border-primary px-2 py-1">
            [ VIEW_ALL_BOOKINGS ]
          </Link>
        </div>
        
        {demandLoading ? (
          <div className="text-muted-foreground blink">ANALYZING_DATA...</div>
        ) : demand?.length === 0 ? (
          <div className="text-muted-foreground">NO_ACTIVE_TRIPS_FOUND</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="p-2 font-normal">TRIP_ID</th>
                  <th className="p-2 font-normal">TIME</th>
                  <th className="p-2 font-normal">DEMAND</th>
                  <th className="p-2 font-normal">CONFIRMED</th>
                  <th className="p-2 font-normal">STATUS</th>
                  <th className="p-2 font-normal text-right">ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {demand?.map((trip) => (
                  <tr key={trip.tripId} className="border-b border-border hover:bg-muted/50">
                    <td className="p-2 font-bold">{trip.tripId}</td>
                    <td className="p-2">{trip.departureTime}</td>
                    <td className="p-2">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1 bg-muted relative">
                          <div 
                            className="absolute top-0 left-0 h-full bg-primary"
                            style={{ width: `${Math.min((trip.bookingCount / (trip.bookingCount + trip.availableSeats)) * 100, 100)}%` }}
                          />
                        </div>
                        <span>{trip.bookingCount}</span>
                      </div>
                    </td>
                    <td className="p-2">{trip.confirmedCount}</td>
                    <td className="p-2">
                      {trip.status === "pending" && <span className="text-yellow-500 font-bold">[PENDING]</span>}
                      {trip.status === "confirmed" && <span className="text-primary font-bold">[CONFIRMED]</span>}
                      {trip.status === "canceled" && <span className="text-destructive font-bold">[CANCELED]</span>}
                    </td>
                    <td className="p-2 text-right">
                      {trip.status === "pending" && (
                        <div className="flex justify-end gap-2">
                          <button 
                            onClick={() => handleConfirmTrip(trip.tripId)}
                            className="px-2 py-1 border border-primary text-primary hover:bg-primary hover:text-primary-foreground transition-colors text-xs"
                          >
                            FORCE_CONFIRM
                          </button>
                          <button 
                            onClick={() => handleCancelTrip(trip.tripId)}
                            className="px-2 py-1 border border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground transition-colors text-xs"
                          >
                            CANCEL
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
