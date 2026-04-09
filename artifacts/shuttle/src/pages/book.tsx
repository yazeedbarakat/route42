import { useGetTrips, useGetPickupPoints, useCreateBooking } from "@workspace/api-client-react";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { format, addDays } from "date-fns";

export default function Book() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    if (!user) setLocation("/");
    else if (user.role !== "student") setLocation(user.role === "admin" ? "/admin" : "/driver");
  }, [user, setLocation]);

  const tomorrow = format(addDays(new Date(), 1), "yyyy-MM-dd");

  const { data: trips, isLoading: tripsLoading } = useGetTrips({ date: tomorrow });
  const { data: pickupPoints, isLoading: pointsLoading } = useGetPickupPoints();
  
  const createBooking = useCreateBooking();

  const [selectedTrip, setSelectedTrip] = useState<number | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<number | null>(null);

  const handleBook = async () => {
    if (!selectedTrip || !selectedPoint) return;
    
    try {
      await createBooking.mutateAsync({
        data: { tripId: selectedTrip, pickupPointId: selectedPoint }
      });
      toast({ title: "SYSTEM", description: "BOOKING_CREATED_SUCCESSFULLY" });
      setLocation("/dashboard");
    } catch (err: any) {
      toast({ 
        title: "ERR_BOOKING_FAILED", 
        description: err?.message || "TRANSACTION_FAILED",
        variant: "destructive"
      });
    }
  };

  const activeTrip = trips?.find(t => t.id === selectedTrip);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="border border-border p-4 bg-card">
        <h1 className="text-xl font-bold text-primary mb-2">{">"} INITIATE_BOOKING</h1>
        <div className="text-sm text-muted-foreground">
          TARGET_DATE: {tomorrow}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-6">
          <div className="border border-border p-4">
            <h2 className="text-lg font-bold mb-4 border-b border-border pb-2">1. SELECT_TRIP_TIME</h2>
            {tripsLoading ? (
              <div className="blink text-muted-foreground">FETCHING_TRIPS...</div>
            ) : trips?.length === 0 ? (
              <div className="text-destructive">NO_TRIPS_AVAILABLE_FOR_TOMORROW</div>
            ) : (
              <div className="space-y-2">
                {trips?.map((trip) => {
                  const isFull = trip.availableSeats <= 0;
                  return (
                    <button
                      key={trip.id}
                      onClick={() => !isFull && setSelectedTrip(trip.id)}
                      disabled={isFull}
                      className={`w-full text-left p-3 border transition-colors flex justify-between items-center ${
                        selectedTrip === trip.id 
                          ? "border-primary bg-primary/10 text-primary" 
                          : isFull 
                            ? "border-destructive/30 opacity-50 cursor-not-allowed" 
                            : "border-border hover:border-primary/50"
                      }`}
                    >
                      <span className="font-bold">{trip.departureTime}</span>
                      <span className="text-sm">
                        {isFull ? "[FULL]" : `${trip.availableSeats} SEATS_LEFT`}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="border border-border p-4">
            <h2 className="text-lg font-bold mb-4 border-b border-border pb-2">2. SELECT_PICKUP</h2>
            {pointsLoading ? (
              <div className="blink text-muted-foreground">FETCHING_POINTS...</div>
            ) : (
              <div className="space-y-2">
                {pickupPoints?.map((point) => (
                  <button
                    key={point.id}
                    onClick={() => setSelectedPoint(point.id)}
                    className={`w-full text-left p-3 border transition-colors ${
                      selectedPoint === point.id 
                        ? "border-primary bg-primary/10 text-primary" 
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <span className="font-bold">{point.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="border border-border p-4 h-fit sticky top-4">
          <h2 className="text-lg font-bold mb-4 border-b border-border pb-2">TRANSACTION_SUMMARY</h2>
          
          <div className="space-y-4 font-mono text-sm mb-8">
            <div className="flex justify-between">
              <span className="text-muted-foreground">DATE:</span>
              <span>{tomorrow}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">TIME:</span>
              <span className={activeTrip ? "text-primary" : "text-muted-foreground"}>
                {activeTrip ? activeTrip.departureTime : "---"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">PICKUP:</span>
              <span className={selectedPoint ? "text-primary" : "text-muted-foreground"}>
                {selectedPoint ? pickupPoints?.find(p => p.id === selectedPoint)?.name : "---"}
              </span>
            </div>
            
            {activeTrip && (
              <div className="mt-6 pt-4 border-t border-border">
                <div className="text-xs text-muted-foreground mb-1">CAPACITY_STATUS:</div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="flex-1 h-2 bg-muted relative border border-border">
                    <div 
                      className="absolute top-0 left-0 h-full bg-primary"
                      style={{ width: `${(activeTrip.bookedSeats / activeTrip.totalSeats) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs">{activeTrip.bookedSeats}/{activeTrip.totalSeats}</span>
                </div>
                <div className="text-xs text-muted-foreground text-right">
                  MIN_REQD: {activeTrip.minBookingsToConfirm}
                </div>
              </div>
            )}
          </div>

          <button
            onClick={handleBook}
            disabled={!selectedTrip || !selectedPoint || createBooking.isPending}
            className="w-full p-4 border border-primary font-bold transition-colors disabled:opacity-50 disabled:border-muted disabled:text-muted-foreground bg-primary text-primary-foreground hover:bg-transparent hover:text-primary"
          >
            {createBooking.isPending ? "PROCESSING..." : "[ SUBMIT_BOOKING ]"}
          </button>
        </div>
      </div>
    </div>
  );
}
