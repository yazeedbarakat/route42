import { Router, type IRouter } from "express";
import { db, tripsTable, bookingsTable, usersTable } from "@workspace/db";
import { eq, and, sql, count, sum } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth";
import { GetTripDemandQueryParams } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/stats/dashboard", requireAuth, requireRole("admin"), async (_req, res): Promise<void> => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.setHeader("Pragma", "no-cache");

  const today = new Date().toISOString().split("T")[0];
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekAgoStr = weekAgo.toISOString().split("T")[0];

  // 1. totalStudents
  const [totalStudentsResult] = await db
    .select({ count: count() })
    .from(usersTable)
    .where(eq(usersTable.role, "student"));

  // 2. bookingsToday — non-cancelled bookings joined to today's trips
  const [bookingsTodayResult] = await db
    .select({ count: count() })
    .from(bookingsTable)
    .innerJoin(tripsTable, eq(bookingsTable.tripId, tripsTable.id))
    .where(
      and(
        eq(tripsTable.date, today),
        sql`${bookingsTable.status} != 'canceled'`,
      ),
    );

  // 3. confirmedTrips — trips with status = confirmed today
  const [confirmedTripsResult] = await db
    .select({ count: count() })
    .from(tripsTable)
    .where(and(eq(tripsTable.date, today), eq(tripsTable.status, "confirmed")));

  // 4. pendingTrips — trips with status = pending today
  const [pendingTripsResult] = await db
    .select({ count: count() })
    .from(tripsTable)
    .where(and(eq(tripsTable.date, today), eq(tripsTable.status, "pending")));

  // 5. tripsThisWeek
  const [thisWeekResult] = await db
    .select({ count: count() })
    .from(tripsTable)
    .where(sql`${tripsTable.date} >= ${weekAgoStr} AND ${tripsTable.date} <= ${today}`);

  // 6. avgOccupancy — (non-cancelled bookings today / total seats today) * 100
  const [totalSeatsResult] = await db
    .select({ totalSeats: sum(tripsTable.totalSeats) })
    .from(tripsTable)
    .where(eq(tripsTable.date, today));

  const totalSeatsToday = Number(totalSeatsResult?.totalSeats ?? 0);
  const bookingsToday = bookingsTodayResult?.count ?? 0;
  const avgOccupancy = totalSeatsToday > 0
    ? Math.round((bookingsToday / totalSeatsToday) * 100)
    : 0;

  // 7. peakTime — today's trip with the most non-cancelled bookings
  const todayTripsWithBookings = await db
    .select({
      departureTime: tripsTable.departureTime,
      bookingCount: count(bookingsTable.id),
    })
    .from(tripsTable)
    .leftJoin(
      bookingsTable,
      and(
        eq(bookingsTable.tripId, tripsTable.id),
        sql`${bookingsTable.status} != 'canceled'`,
      ),
    )
    .where(eq(tripsTable.date, today))
    .groupBy(tripsTable.id, tripsTable.departureTime);

  let peakTime: string | null = null;
  if (todayTripsWithBookings.length > 0) {
    const peak = todayTripsWithBookings.reduce((best, row) =>
      row.bookingCount > best.bookingCount ? row : best,
    );
    if (peak.bookingCount > 0) {
      peakTime = formatTime(peak.departureTime);
    }
  }

  // 8. efficiency — (bookedSeats / totalSeats) * 100 for confirmed trips today
  const [confirmedSeats] = await db
    .select({
      bookedSeats: sum(tripsTable.bookedSeats),
      totalSeats: sum(tripsTable.totalSeats),
    })
    .from(tripsTable)
    .where(and(eq(tripsTable.date, today), eq(tripsTable.status, "confirmed")));

  const filledSeats = Number(confirmedSeats?.bookedSeats ?? 0);
  const confirmedCapacity = Number(confirmedSeats?.totalSeats ?? 0);
  const efficiency = confirmedCapacity > 0
    ? Math.round((filledSeats / confirmedCapacity) * 100)
    : 0;

  res.json({
    totalStudents: totalStudentsResult?.count ?? 0,
    bookingsToday,
    confirmedTrips: confirmedTripsResult?.count ?? 0,
    pendingTrips: pendingTripsResult?.count ?? 0,
    tripsThisWeek: thisWeekResult?.count ?? 0,
    avgOccupancy,
    peakTime,
    efficiency,
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

function formatTime(hhmm: string): string {
  const [hStr, mStr] = hhmm.split(":");
  const h = parseInt(hStr, 10);
  const m = mStr ?? "00";
  const period = h >= 12 ? "PM" : "AM";
  const displayH = h % 12 === 0 ? 12 : h % 12;
  return `${displayH}:${m} ${period}`;
}

export default router;
