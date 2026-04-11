import { Router, type IRouter } from "express";
import { db, tripsTable, bookingsTable, usersTable } from "@workspace/db";
import { eq, and, sql, count } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth";
import { GetTripDemandQueryParams } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/stats/dashboard", requireAuth, requireRole("admin"), async (_req, res): Promise<void> => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  const today = new Date().toISOString().split("T")[0];

  const [totalBookingsTodayResult] = await db
    .select({ count: count() })
    .from(bookingsTable)
    .innerJoin(tripsTable, eq(bookingsTable.tripId, tripsTable.id))
    .where(eq(tripsTable.date, today));

  const [confirmedTripsResult] = await db
    .select({ count: count() })
    .from(tripsTable)
    .where(and(eq(tripsTable.date, today), eq(tripsTable.status, "confirmed")));

  const [pendingTripsResult] = await db
    .select({ count: count() })
    .from(tripsTable)
    .where(and(eq(tripsTable.date, today), eq(tripsTable.status, "pending")));

  const [totalStudentsResult] = await db
    .select({ count: count() })
    .from(usersTable)
    .where(eq(usersTable.role, "student"));

  // This week's trips
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekAgoStr = weekAgo.toISOString().split("T")[0];

  const [thisWeekResult] = await db
    .select({ count: count() })
    .from(tripsTable)
    .where(sql`${tripsTable.date} >= ${weekAgoStr} AND ${tripsTable.date} <= ${today}`);

  // Average occupancy
  const allTrips = await db.select().from(tripsTable);
  const avgOccupancy = allTrips.length > 0
    ? allTrips.reduce((sum, t) => sum + (t.bookedSeats / t.totalSeats), 0) / allTrips.length
    : 0;

  res.json({
    totalBookingsToday: totalBookingsTodayResult?.count ?? 0,
    confirmedTripsToday: confirmedTripsResult?.count ?? 0,
    pendingTripsToday: pendingTripsResult?.count ?? 0,
    totalStudents: totalStudentsResult?.count ?? 0,
    totalTripsThisWeek: thisWeekResult?.count ?? 0,
    averageOccupancyRate: Math.round(avgOccupancy * 100) / 100,
  });
});

router.get("/stats/demand", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  const parsed = GetTripDemandQueryParams.safeParse(req.query);
  const date = parsed.success && parsed.data.date ? parsed.data.date : getTomorrow();

  const trips = await db.select().from(tripsTable).where(eq(tripsTable.date, date));

  const result = [];
  for (const trip of trips) {
    const allBookings = await db
      .select()
      .from(bookingsTable)
      .where(eq(bookingsTable.tripId, trip.id));

    const confirmed = allBookings.filter(b => b.status === "confirmed").length;
    const pending = allBookings.filter(b => b.status === "pending").length;
    const total = allBookings.filter(b => b.status !== "canceled").length;

    result.push({
      tripId: trip.id,
      departureTime: trip.departureTime,
      direction: trip.direction,
      bookingCount: total,
      confirmedCount: confirmed,
      pendingCount: pending,
      availableSeats: trip.totalSeats - trip.bookedSeats,
      status: trip.status,
    });
  }

  res.json(result);
});

function getTomorrow(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
}

export default router;
