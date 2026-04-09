import { useGetDriverTrips } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { format } from "date-fns";

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
    <div className="space-y-6 max-w-lg mx-auto">
      <div className="border border-border p-4 bg-card text-center">
        <h1 className="text-2xl font-bold text-primary mb-2">ACTIVE_MANIFEST</h1>
        <div className="text-sm text-muted-foreground">
          DRIVER: {user.name} | DATE: {format(new Date(), "yyyy-MM-dd")}
        </div>
      </div>

      {isLoading ? (
        <div className="text-center text-xl blink p-8 border border-border">SYNCING_DATA...</div>
      ) : trips?.length === 0 ? (
        <div className="text-center p-8 border border-border">
          <div className="text-2xl font-bold mb-2">NO_ACTIVE_ROUTES</div>
          <div className="text-muted-foreground">STANDBY_MODE_ENGAGED</div>
        </div>
      ) : (
        <div className="space-y-8">
          {trips?.map((trip) => (
            <div key={trip.id} className="border border-primary">
              <div className="bg-primary text-primary-foreground p-4 flex justify-between items-center">
                <div className="text-3xl font-bold">{trip.departureTime}</div>
                <div className="text-right">
                  <div className="text-sm font-bold opacity-80">TOTAL_PAX</div>
                  <div className="text-3xl font-bold">{trip.totalPassengers}</div>
                </div>
              </div>
              
              <div className="p-4 space-y-4">
                {trip.pickupStops.map((stop, idx) => (
                  <div key={stop.pickupPointId} className="flex items-center gap-4 p-4 border border-border bg-card">
                    <div className="shrink-0 w-12 h-12 flex items-center justify-center border border-primary text-primary font-bold text-xl">
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-xl truncate">{stop.pickupPointName}</div>
                    </div>
                    <div className="shrink-0 text-center px-4 border-l border-border">
                      <div className="text-xs text-muted-foreground">PAX</div>
                      <div className="text-4xl font-bold text-secondary">{stop.passengerCount}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
