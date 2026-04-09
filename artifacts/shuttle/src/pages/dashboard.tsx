import { useGetBookings, useGetTrips } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { Link, useLocation } from "wouter";
import { useEffect } from "react";
import { format } from "date-fns";

export default function Dashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!user) setLocation("/");
    else if (user.role !== "student") setLocation(user.role === "admin" ? "/admin" : "/driver");
  }, [user, setLocation]);

  const { data: bookings, isLoading: bookingsLoading } = useGetBookings();
  
  if (!user) return null;

  const upcomingBookings = bookings?.filter(b => b.status === "pending" || b.status === "confirmed") || [];

  return (
    <div className="space-y-6">
      <div className="border border-border p-4 bg-card">
        <h1 className="text-xl font-bold text-primary mb-2">{">"} STUDENT_DASHBOARD</h1>
        <div className="text-sm text-muted-foreground">
          WELCOME_BACK: {user.name}
          <br />
          STATUS: ACTIVE
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="border border-border p-4">
          <h2 className="text-lg font-bold mb-4">{">"} QUICK_ACTIONS</h2>
          <div className="flex flex-col gap-4">
            <Link href="/book" className="block text-center border border-primary p-4 hover:bg-primary hover:text-primary-foreground transition-colors font-bold">
              [ INITIATE_NEW_BOOKING ]
            </Link>
            <Link href="/map" className="block text-center border border-border p-4 hover:bg-secondary hover:text-secondary-foreground hover:border-secondary transition-colors">
              [ VIEW_ROUTE_MAP ]
            </Link>
          </div>
        </div>

        <div className="border border-border p-4">
          <h2 className="text-lg font-bold mb-4">{">"} UPCOMING_TRIPS</h2>
          {bookingsLoading ? (
            <div className="text-muted-foreground blink">LOADING_DATA...</div>
          ) : upcomingBookings.length === 0 ? (
            <div className="text-muted-foreground">NO_UPCOMING_TRIPS_FOUND</div>
          ) : (
            <div className="space-y-4">
              {upcomingBookings.map((booking) => (
                <div key={booking.id} className="border border-border p-3 relative">
                  <div className="text-sm mb-1">
                    DATE: {format(new Date(booking.trip?.date || ""), "yyyy-MM-dd")}
                  </div>
                  <div className="text-sm mb-1">
                    TIME: {booking.trip?.departureTime}
                  </div>
                  <div className="text-sm mb-2">
                    PICKUP: {booking.pickupPoint?.name}
                  </div>
                  <div className="flex justify-between items-center mt-4">
                    <div className="text-xs text-muted-foreground">
                      ID: {booking.id.toString().padStart(6, '0')}
                    </div>
                    <div>
                      {booking.status === "pending" && (
                        <span className="text-yellow-500 blink font-bold">[PENDING]</span>
                      )}
                      {booking.status === "confirmed" && (
                        <span className="text-primary font-bold">[CONFIRMED]</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="mt-4">
             <Link href="/history" className="text-sm text-primary hover:underline">
               {">"} VIEW_FULL_HISTORY
             </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
