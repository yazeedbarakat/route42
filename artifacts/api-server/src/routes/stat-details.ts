import { Router, type IRouter } from "express";
import { db, tripsTable, bookingsTable, usersTable } from "@workspace/db";
import { eq, and, sql, count, avg, sum } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth";

const router: IRouter = Router();

function getToday(): string {
  return new Date().toISOString().split("T")[0];
}

function getWeekRange(): { start: string; end: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 6);
  return {
    start: start.toISOString().split("T")[0],
    end: end.toISOString().split("T")[0],
  };
}

router.get(
  "/admin/stat-details",
  requireAuth,
  requireRole("admin"),
  async (req, res): Promise<void> => {
    const card = req.query.card as string;

    switch (card) {
      // ── 1. Total Students ──────────────────────────────────────────────────
      case "totalStudents": {
        const students = await db
          .select({
            id: usersTable.id,
            name: usersTable.name,
            email: usersTable.email,
          })
          .from(usersTable)
          .where(eq(usersTable.role, "student"))
          .orderBy(usersTable.name);

        const results = await Promise.all(
          students.map(async (s) => {
            const [{ total }] = await db
              .select({ total: count() })
              .from(bookingsTable)
              .where(eq(bookingsTable.userId, s.id));
            return {
              name: s.name,
              id: s.email,
              totalRides: Number(total),
            };
          }),
        );

        results.sort((a, b) => b.totalRides - a.totalRides);
        res.json({ columns: ["Student Name", "Email", "Total Rides"], rows: results });
        return;
      }

      // ── 2. Bookings Today ──────────────────────────────────────────────────
      case "bookingsToday": {
        const today = getToday();
        const rows = await db
          .select({
            studentName: usersTable.name,
            pickupType: bookingsTable.pickupType,
            pickupName: bookingsTable.pickupName,
            customLat: bookingsTable.customLat,
            customLng: bookingsTable.customLng,
            departureTime: tripsTable.departureTime,
            status: bookingsTable.status,
          })
          .from(bookingsTable)
          .innerJoin(usersTable, eq(bookingsTable.userId, usersTable.id))
          .innerJoin(tripsTable, eq(bookingsTable.tripId, tripsTable.id))
          .where(and(eq(tripsTable.date, today)))
          .orderBy(tripsTable.departureTime);

        const data = rows.map((r) => ({
          name: r.studentName,
          pickupLocation:
            r.pickupType === "fixed"
              ? r.pickupName ?? "Terminal"
              : r.customLat !== null && r.customLng !== null
                ? `Custom (${Number(r.customLat).toFixed(4)}, ${Number(r.customLng).toFixed(4)})`
                : "Custom",
          time: r.departureTime,
          status: r.status,
        }));

        res.json({ columns: ["Student Name", "Pickup Location", "Time", "Status"], rows: data });
        return;
      }

      // ── 3. Confirmed Trips ─────────────────────────────────────────────────
      case "confirmedTrips": {
        const today = getToday();
        const trips = await db
          .select()
          .from(tripsTable)
          .where(and(eq(tripsTable.date, today), eq(tripsTable.status, "confirmed")))
          .orderBy(tripsTable.departureTime);

        const data = await Promise.all(
          trips.map(async (t) => {
            const [{ total }] = await db
              .select({ total: count() })
              .from(bookingsTable)
              .where(
                and(
                  eq(bookingsTable.tripId, t.id),
                  sql`${bookingsTable.status} != 'canceled'`,
                ),
              );
            return {
              time: t.departureTime,
              direction: t.direction === "to_school" ? "→ Campus" : "← Home",
              passengers: `${total}/${t.totalSeats}`,
            };
          }),
        );

        res.json({ columns: ["Time", "Direction", "Passengers"], rows: data });
        return;
      }

      // ── 4. Pending Trips ───────────────────────────────────────────────────
      case "pendingTrips": {
        const today = getToday();
        const trips = await db
          .select()
          .from(tripsTable)
          .where(and(eq(tripsTable.date, today), eq(tripsTable.status, "pending")))
          .orderBy(tripsTable.departureTime);

        const data = await Promise.all(
          trips.map(async (t) => {
            const [{ total }] = await db
              .select({ total: count() })
              .from(bookingsTable)
              .where(
                and(
                  eq(bookingsTable.tripId, t.id),
                  sql`${bookingsTable.status} != 'canceled'`,
                ),
              );
            const waiting = Number(total);
            const needed = Math.max(0, t.minBookingsToConfirm - waiting);
            return {
              time: t.departureTime,
              passengersWaiting: waiting,
              seatsNeeded: needed,
            };
          }),
        );

        res.json({ columns: ["Time", "Passengers Waiting", "Seats Needed to Confirm"], rows: data });
        return;
      }

      // ── 5. Trips This Week ─────────────────────────────────────────────────
      case "tripsThisWeek": {
        const { start, end } = getWeekRange();
        const trips = await db
          .select()
          .from(tripsTable)
          .where(sql`${tripsTable.date} >= ${start} AND ${tripsTable.date} <= ${end}`)
          .orderBy(tripsTable.date);

        // Group by date
        const byDate = new Map<string, { dispatched: number; passengers: number }>();
        for (const t of trips) {
          const entry = byDate.get(t.date) ?? { dispatched: 0, passengers: 0 };
          entry.dispatched += 1;
          entry.passengers += t.bookedSeats;
          byDate.set(t.date, entry);
        }

        const data = Array.from(byDate.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, v]) => ({
            date,
            tripsDispatched: v.dispatched,
            totalPassengers: v.passengers,
          }));

        res.json({ columns: ["Date", "Trips Dispatched", "Total Passengers"], rows: data });
        return;
      }

      // ── 6. Avg Occupancy ───────────────────────────────────────────────────
      case "avgOccupancy": {
        const { start, end } = getWeekRange();
        const trips = await db
          .select()
          .from(tripsTable)
          .where(sql`${tripsTable.date} >= ${start} AND ${tripsTable.date} <= ${end}`)
          .orderBy(tripsTable.date);

        const byDate = new Map<string, { totalPct: number; count: number; seats: number }>();
        for (const t of trips) {
          const entry = byDate.get(t.date) ?? { totalPct: 0, count: 0, seats: 0 };
          entry.totalPct += t.totalSeats > 0 ? (t.bookedSeats / t.totalSeats) * 100 : 0;
          entry.count += 1;
          entry.seats += t.bookedSeats;
          byDate.set(t.date, entry);
        }

        const data = Array.from(byDate.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, v]) => ({
            date,
            avgFilled: v.count > 0 ? `${Math.round(v.totalPct / v.count)}%` : "0%",
            totalSeatsUsed: v.seats,
          }));

        res.json({ columns: ["Date", "Avg % Filled", "Total Seats Used"], rows: data });
        return;
      }

      // ── 7. Peak Time ───────────────────────────────────────────────────────
      case "peakTime": {
        const rows = await db
          .select({
            departureTime: tripsTable.departureTime,
            bookings: count(bookingsTable.id),
          })
          .from(tripsTable)
          .leftJoin(
            bookingsTable,
            and(
              eq(bookingsTable.tripId, tripsTable.id),
              sql`${bookingsTable.status} != 'canceled'`,
            ),
          )
          .groupBy(tripsTable.departureTime)
          .orderBy(sql`count(${bookingsTable.id}) DESC`);

        const data = rows.map((r) => ({
          timeSlot: r.departureTime,
          requests: Number(r.bookings),
        }));

        res.json({ columns: ["Time Slot", "Number of Requests"], rows: data });
        return;
      }

      // ── 8. Efficiency ──────────────────────────────────────────────────────
      case "efficiency": {
        const { start, end } = getWeekRange();
        const trips = await db
          .select()
          .from(tripsTable)
          .where(sql`${tripsTable.date} >= ${start} AND ${tripsTable.date} <= ${end}`)
          .orderBy(tripsTable.date);

        const byDate = new Map<string, { totalPct: number; count: number; wasted: number }>();
        for (const t of trips) {
          const entry = byDate.get(t.date) ?? { totalPct: 0, count: 0, wasted: 0 };
          entry.totalPct += t.totalSeats > 0 ? (t.bookedSeats / t.totalSeats) * 100 : 0;
          entry.count += 1;
          entry.wasted += Math.max(0, t.totalSeats - t.bookedSeats);
          byDate.set(t.date, entry);
        }

        const data = Array.from(byDate.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, v]) => ({
            date,
            efficiencyPct: v.count > 0 ? `${Math.round(v.totalPct / v.count)}%` : "0%",
            wastedSeats: v.wasted,
          }));

        res.json({ columns: ["Date", "Efficiency %", "Wasted Seats"], rows: data });
        return;
      }

      default:
        res.status(400).json({ error: "Unknown card type" });
    }
  },
);

export default router;
