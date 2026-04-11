import { Router, type IRouter } from "express";
import { db, tripsTable, bookingsTable, usersTable } from "@workspace/db";
import { eq, and, sql, count, inArray } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth";
import { GetTripDemandQueryParams } from "@workspace/api-zod";

const router: IRouter = Router();

function getDateInAmman(offsetDays = 0): string {
  const now = new Date();
  const ammanStr = now.toLocaleString("en-CA", { timeZone: "Asia/Amman" });
  const datePart = ammanStr.split(",")[0].trim();
  if (offsetDays === 0) return datePart;
  const [year, month, day] = datePart.split("-").map(Number);
  const d = new Date(year, month - 1, day + offsetDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

router.get("/stats/dashboard", requireAuth, requireRole("admin"), async (_req, res): Promise<void> => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.setHeader("Pragma", "no-cache");

  const today = getDateInAmman(0);

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

  // 4. peakTime — today's trip with the most non-cancelled bookings
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

  res.json({
    totalStudents: totalStudentsResult?.count ?? 0,
    bookingsToday: bookingsTodayResult?.count ?? 0,
    confirmedTrips: confirmedTripsResult?.count ?? 0,
    peakTime,
  });
});

router.get("/stats/demand", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.setHeader("Pragma", "no-cache");

  const parsed = GetTripDemandQueryParams.safeParse(req.query);
  const today = getDateInAmman(0);
  const tomorrow = getDateInAmman(1);

  const requestedDate = parsed.success && parsed.data.date ? parsed.data.date : null;
  const datesToQuery = requestedDate ? [requestedDate] : [today, tomorrow];

  const trips = await db
    .select()
    .from(tripsTable)
    .where(inArray(tripsTable.date, datesToQuery));

  if (trips.length === 0) {
    res.json([]);
    return;
  }

  const tripIds = trips.map(t => t.id);

  const allBookings = await db
    .select({
      tripId: bookingsTable.tripId,
      status: bookingsTable.status,
    })
    .from(bookingsTable)
    .where(inArray(bookingsTable.tripId, tripIds));

  const bookingMap = new Map<number, { confirmed: number; pending: number; total: number }>();
  for (const b of allBookings) {
    if (!bookingMap.has(b.tripId)) {
      bookingMap.set(b.tripId, { confirmed: 0, pending: 0, total: 0 });
    }
    const entry = bookingMap.get(b.tripId)!;
    if (b.status !== "canceled") entry.total++;
    if (b.status === "confirmed") entry.confirmed++;
    if (b.status === "pending") entry.pending++;
  }

  const result = trips.map(trip => {
    const counts = bookingMap.get(trip.id) ?? { confirmed: 0, pending: 0, total: 0 };
    return {
      tripId: trip.id,
      date: trip.date,
      departureTime: trip.departureTime,
      direction: trip.direction,
      bookingCount: counts.total,
      confirmedCount: counts.confirmed,
      pendingCount: counts.pending,
      availableSeats: trip.totalSeats - trip.bookedSeats,
      status: trip.status,
    };
  });

  res.json(result);
});

function formatTime(hhmm: string): string {
  const [hStr, mStr] = hhmm.split(":");
  const h = parseInt(hStr, 10);
  const m = mStr ?? "00";
  const period = h >= 12 ? "PM" : "AM";
  const displayH = h % 12 === 0 ? 12 : h % 12;
  return `${displayH}:${m} ${period}`;
}

export default router;
