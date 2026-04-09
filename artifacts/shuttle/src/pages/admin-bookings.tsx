import { useGetAdminBookings } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { format } from "date-fns";

export default function AdminBookings() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!user) setLocation("/");
    else if (user.role !== "admin") setLocation(user.role === "student" ? "/dashboard" : "/driver");
  }, [user, setLocation]);

  const [dateFilter, setDateFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");

  const { data: bookings, isLoading } = useGetAdminBookings({
    date: dateFilter || undefined,
    status: statusFilter || undefined,
  });

  if (!user) return null;

  return (
    <div className="space-y-6">
      <div className="border border-border p-4 bg-card flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h1 className="text-xl font-bold text-primary mb-2">{">"} ALL_BOOKINGS_LOG</h1>
          <div className="text-sm text-muted-foreground">
            TOTAL_RECORDS: {bookings?.length || 0}
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-2">
          <input 
            type="date" 
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="bg-background border border-border p-2 text-sm focus:border-primary focus:outline-none"
          />
          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-background border border-border p-2 text-sm focus:border-primary focus:outline-none"
          >
            <option value="">ALL_STATUSES</option>
            <option value="pending">PENDING</option>
            <option value="confirmed">CONFIRMED</option>
            <option value="canceled">CANCELED</option>
          </select>
        </div>
      </div>

      <div className="border border-border p-4">
        {isLoading ? (
          <div className="text-muted-foreground blink">FETCHING_RECORDS...</div>
        ) : bookings?.length === 0 ? (
          <div className="text-muted-foreground">NO_RECORDS_MATCH_CRITERIA</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="p-2 font-normal">ID</th>
                  <th className="p-2 font-normal">STUDENT</th>
                  <th className="p-2 font-normal">DATE/TIME</th>
                  <th className="p-2 font-normal">PICKUP_POINT</th>
                  <th className="p-2 font-normal">STATUS</th>
                  <th className="p-2 font-normal">CREATED_AT</th>
                </tr>
              </thead>
              <tbody>
                {bookings?.map((booking) => (
                  <tr key={booking.id} className="border-b border-border hover:bg-muted/50">
                    <td className="p-2 font-bold">{booking.id.toString().padStart(6, '0')}</td>
                    <td className="p-2">
                      <div className="font-bold">{booking.user?.name}</div>
                      <div className="text-xs text-muted-foreground">{booking.user?.email}</div>
                    </td>
                    <td className="p-2">
                      <div>{format(new Date(booking.trip?.date || ""), "yyyy-MM-dd")}</div>
                      <div className="text-muted-foreground">{booking.trip?.departureTime}</div>
                    </td>
                    <td className="p-2">{booking.pickupPoint?.name}</td>
                    <td className="p-2">
                      {booking.status === "pending" && <span className="text-yellow-500 font-bold">[PENDING]</span>}
                      {booking.status === "confirmed" && <span className="text-primary font-bold">[CONFIRMED]</span>}
                      {booking.status === "canceled" && <span className="text-destructive font-bold">[CANCELED]</span>}
                    </td>
                    <td className="p-2 text-muted-foreground text-xs">
                      {format(new Date(booking.createdAt), "yyyy-MM-dd HH:mm")}
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
