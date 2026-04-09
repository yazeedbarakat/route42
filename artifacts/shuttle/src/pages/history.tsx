import { useGetBookingHistory, useCancelBooking } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

export default function History() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    if (!user) setLocation("/");
    else if (user.role !== "student") setLocation(user.role === "admin" ? "/admin" : "/driver");
  }, [user, setLocation]);

  const { data: bookings, isLoading, refetch } = useGetBookingHistory();
  const cancelBooking = useCancelBooking();

  const handleCancel = async (id: number) => {
    if (!confirm("ARE_YOU_SURE_YOU_WANT_TO_CANCEL_THIS_BOOKING?")) return;
    
    try {
      await cancelBooking.mutateAsync({ id });
      toast({ title: "SYSTEM", description: "BOOKING_CANCELED_SUCCESSFULLY" });
      refetch();
    } catch (err: any) {
      toast({ 
        title: "ERR_CANCEL_FAILED", 
        description: err?.message || "TRANSACTION_FAILED",
        variant: "destructive"
      });
    }
  };

  if (!user) return null;

  return (
    <div className="space-y-6">
      <div className="border border-border p-4 bg-card">
        <h1 className="text-xl font-bold text-primary mb-2">{">"} BOOKING_HISTORY</h1>
        <div className="text-sm text-muted-foreground">
          TOTAL_RECORDS: {bookings?.length || 0}
        </div>
      </div>

      <div className="border border-border p-4">
        {isLoading ? (
          <div className="text-muted-foreground blink">FETCHING_RECORDS...</div>
        ) : bookings?.length === 0 ? (
          <div className="text-muted-foreground">NO_RECORDS_FOUND</div>
        ) : (
          <div className="space-y-4">
            {bookings?.map((booking) => (
              <div key={booking.id} className="border border-border p-4 relative flex flex-col md:flex-row md:justify-between md:items-center gap-4">
                <div>
                  <div className="text-sm mb-1">
                    <span className="text-muted-foreground">DATE:</span> {format(new Date(booking.trip?.date || ""), "yyyy-MM-dd")}
                  </div>
                  <div className="text-sm mb-1">
                    <span className="text-muted-foreground">TIME:</span> {booking.trip?.departureTime}
                  </div>
                  <div className="text-sm mb-1">
                    <span className="text-muted-foreground">PICKUP:</span> {booking.pickupPoint?.name}
                  </div>
                  <div className="text-xs text-muted-foreground mt-2">
                    ID: {booking.id.toString().padStart(6, '0')}
                  </div>
                </div>
                
                <div className="flex flex-col items-end gap-2">
                  <div>
                    {booking.status === "pending" && (
                      <span className="text-yellow-500 blink font-bold">[PENDING]</span>
                    )}
                    {booking.status === "confirmed" && (
                      <span className="text-primary font-bold">[CONFIRMED]</span>
                    )}
                    {booking.status === "canceled" && (
                      <span className="text-destructive font-bold line-through">[CANCELED]</span>
                    )}
                  </div>
                  
                  {booking.status === "pending" && (
                    <button 
                      onClick={() => handleCancel(booking.id)}
                      disabled={cancelBooking.isPending}
                      className="text-xs border border-destructive text-destructive p-1 hover:bg-destructive hover:text-destructive-foreground transition-colors disabled:opacity-50"
                    >
                      [ CANCEL_BOOKING ]
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
