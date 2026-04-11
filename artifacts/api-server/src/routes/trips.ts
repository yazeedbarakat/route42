import { Router, type IRouter } from "express";
import { db, tripsTable, bookingsTable, pickupPointsTable, notificationsTable, usersTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth";
import { GetTripsQueryParams, ConfirmTripParams, CancelTripParams } from "@workspace/api-zod";

const router: IRouter = Router();

// ─── Default schedule — mirrors the frontend TIME_SLOTS constants ─────────────
const DEFAULT_SCHEDULE: { time: string; direction: string }[] = [
  { time: "08:00 AM", direction: "to_school"   },
  { time: "10:00 AM", direction: "to_school"   },
  { time: "12:00 PM", direction: "to_school"   },
  { time: "01:00 PM", direction: "from_school" },
  { time: "02:00 PM", direction: "to_school"   },
  { time: "03:00 PM", direction: "from_school" },
  { time: "04:00 PM", direction: "to_school"   },
  { time: "05:00 PM", direction: "from_school" },
  { time: "06:00 PM", direction: "to_school"   },
  { time: "07:00 PM", direction: "from_school" },
];

async function seedTripsForDate(date: string) {
  const existing = await db.select().from(tripsTable).where(eq(tripsTable.date, date));
  if (existing.length > 0) return existing;

  const rows = DEFAULT_SCHEDULE.map(s => ({
    date,
    departureTime: s.time,
    direction: s.direction,
    status: "pending" as const,
    totalSeats: 15,
    bookedSeats: 0,
    minBookingsToConfirm: 5,
  }));

  const inserted = await db.insert(tripsTable).values(rows).returning();
  return inserted;
}

function formatTrip(trip: typeof tripsTable.$inferSelect) {
  return {
    id: trip.id,
    date: trip.date,
    departureTime: trip.departureTime,
    status: trip.status,
    totalSeats: trip.totalSeats,
    bookedSeats: trip.bookedSeats,
    availableSeats: trip.totalSeats - trip.bookedSeats,
    minBookingsToConfirm: trip.minBookingsToConfirm,
    direction: trip.direction,
    createdAt: trip.createdAt.toISOString(),
  };
}

router.get("/trips", requireAuth, async (req, res): Promise<void> => {
  const parsed = GetTripsQueryParams.safeParse(req.query);
  const date = parsed.success && parsed.data.date ? parsed.data.date : getTomorrow();

  // Only auto-seed for today or future dates
  const today = new Date().toISOString().split("T")[0];
  if (date >= today) {
    await seedTripsForDate(date);
  }

  const trips = await db
    .select()
    .from(tripsTable)
    .where(eq(tripsTable.date, date));

  res.json(trips.map(formatTrip));
});

router.get("/trips/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid trip ID" });
    return;
  }

  const [trip] = await db.select().from(tripsTable).where(eq(tripsTable.id, id));
  if (!trip) {
    res.status(404).json({ error: "Trip not found" });
    return;
  }

  res.json(formatTrip(trip));
});

router.post("/admin/trips/:id/confirm", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const params = ConfirmTripParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [trip] = await db
    .update(tripsTable)
    .set({ status: "confirmed" })
    .where(eq(tripsTable.id, params.data.id))
    .returning();

  if (!trip) {
    res.status(404).json({ error: "Trip not found" });
    return;
  }

  const pendingBookings = await db
    .select()
    .from(bookingsTable)
    .where(and(eq(bookingsTable.tripId, trip.id), eq(bookingsTable.status, "pending")));

  if (pendingBookings.length > 0) {
    await db
      .update(bookingsTable)
      .set({ status: "confirmed" })
      .where(and(eq(bookingsTable.tripId, trip.id), eq(bookingsTable.status, "pending")));

    for (const booking of pendingBookings) {
      await db.insert(notificationsTable).values({
        userId: booking.userId,
        message: `Your shuttle booking for ${trip.date} at ${trip.departureTime} has been CONFIRMED. Be ready at your pickup point.`,
        type: "trip_confirmed",
        isRead: false,
      });
    }
  }

  res.json(formatTrip(trip));
});

router.post("/admin/trips/:id/cancel", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const params = CancelTripParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [trip] = await db
    .update(tripsTable)
    .set({ status: "canceled" })
    .where(eq(tripsTable.id, params.data.id))
    .returning();

  if (!trip) {
    res.status(404).json({ error: "Trip not found" });
    return;
  }

  const affectedBookings = await db
    .select()
    .from(bookingsTable)
    .where(and(eq(bookingsTable.tripId, trip.id)));

  if (affectedBookings.length > 0) {
    await db
      .update(bookingsTable)
      .set({ status: "canceled" })
      .where(eq(bookingsTable.tripId, trip.id));

    await db
      .update(tripsTable)
      .set({ bookedSeats: 0 })
      .where(eq(tripsTable.id, trip.id));

    for (const booking of affectedBookings) {
      if (booking.status !== "canceled") {
        await db.insert(notificationsTable).values({
          userId: booking.userId,
          message: `Your shuttle booking for ${trip.date} at ${trip.departureTime} has been CANCELED. Not enough demand.`,
          type: "trip_canceled",
          isRead: false,
        });
      }
    }
  }

  res.json(formatTrip(trip));
});

router.get("/driver/trips", requireAuth, requireRole("driver", "admin"), async (req, res): Promise<void> => {
  const today = new Date().toISOString().split("T")[0];
  const trips = await db
    .select()
    .from(tripsTable)
    .where(and(eq(tripsTable.status, "confirmed"), sql`${tripsTable.date} >= ${today}`));

  const result = [];
  for (const trip of trips) {
    const stops = await db
      .select({
        pickupPointId: bookingsTable.pickupPointId,
        passengerCount: sql<number>`count(*)::int`,
        pickupPointName: pickupPointsTable.name,
        lat: pickupPointsTable.lat,
        lng: pickupPointsTable.lng,
        routeOrder: pickupPointsTable.routeOrder,
      })
      .from(bookingsTable)
      .innerJoin(pickupPointsTable, eq(bookingsTable.pickupPointId, pickupPointsTable.id))
      .where(and(eq(bookingsTable.tripId, trip.id), eq(bookingsTable.status, "confirmed")))
      .groupBy(
        bookingsTable.pickupPointId,
        pickupPointsTable.name,
        pickupPointsTable.lat,
        pickupPointsTable.lng,
        pickupPointsTable.routeOrder
      );

    const totalPassengers = stops.reduce((sum, s) => sum + s.passengerCount, 0);

    result.push({
      id: trip.id,
      date: trip.date,
      departureTime: trip.departureTime,
      direction: trip.direction,
      totalPassengers,
      pickupStops: stops.map(s => ({
        pickupPointId: s.pickupPointId,
        pickupPointName: s.pickupPointName,
        passengerCount: s.passengerCount,
        lat: s.lat,
        lng: s.lng,
        routeOrder: s.routeOrder,
      })),
    });
  }

  res.json(result);
});

// ─── Driver: full trip list for a given date (defaults to today) ──────────────
router.get("/driver/trips/today", requireAuth, requireRole("driver", "admin"), async (req, res): Promise<void> => {
  const today = new Date().toISOString().split("T")[0];
  const rawDate = typeof req.query.date === "string" ? req.query.date : today;
  const dateISO = /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : today;

  if (dateISO >= today) {
    await seedTripsForDate(dateISO);
  }

  const trips = await db
    .select()
    .from(tripsTable)
    .where(eq(tripsTable.date, dateISO));

  const result = [];
  for (const trip of trips) {
    const passengers = await db
      .select({
        bookingId: bookingsTable.id,
        studentName: usersTable.name,
        studentEmail: usersTable.email,
        studentPhone: usersTable.phone,
        pickupType: bookingsTable.pickupType,
        pickupName: bookingsTable.pickupName,
        customLat: bookingsTable.customLat,
        customLng: bookingsTable.customLng,
        pickupPointName: pickupPointsTable.name,
      })
      .from(bookingsTable)
      .innerJoin(usersTable, eq(bookingsTable.userId, usersTable.id))
      .leftJoin(pickupPointsTable, eq(bookingsTable.pickupPointId, pickupPointsTable.id))
      .where(
        and(
          eq(bookingsTable.tripId, trip.id),
          sql`${bookingsTable.status} != 'canceled'`
        )
      );

    result.push({
      id: trip.id,
      date: trip.date,
      departureTime: trip.departureTime,
      direction: trip.direction,
      status: trip.status,
      bookedSeats: trip.bookedSeats,
      totalSeats: trip.totalSeats,
      minBookingsToConfirm: trip.minBookingsToConfirm,
      passengers: passengers.map(p => ({
        bookingId: p.bookingId,
        studentName: p.studentName,
        studentEmail: p.studentEmail,
        studentPhone: p.studentPhone ?? null,
        pickupType: p.pickupType,
        pickupName: p.pickupType === "fixed" ? (p.pickupPointName ?? p.pickupName) : p.pickupName,
        customLat: p.customLat ? parseFloat(p.customLat) : null,
        customLng: p.customLng ? parseFloat(p.customLng) : null,
      })),
    });
  }

  res.json(result);
});

// ─── Driver: manually accept (force-confirm) a trip ──────────────────────────
router.post("/driver/trips/:id/accept", requireAuth, requireRole("driver", "admin"), async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid trip ID" }); return; }

  const [trip] = await db
    .update(tripsTable)
    .set({ status: "confirmed" })
    .where(eq(tripsTable.id, id))
    .returning();

  if (!trip) { res.status(404).json({ error: "Trip not found" }); return; }

  const pendingBookings = await db
    .select()
    .from(bookingsTable)
    .where(and(eq(bookingsTable.tripId, id), eq(bookingsTable.status, "pending")));

  if (pendingBookings.length > 0) {
    await db
      .update(bookingsTable)
      .set({ status: "confirmed" })
      .where(and(eq(bookingsTable.tripId, id), eq(bookingsTable.status, "pending")));

    for (const booking of pendingBookings) {
      await db.insert(notificationsTable).values({
        userId: booking.userId,
        message: `Your shuttle booking for ${trip.date} at ${trip.departureTime} has been CONFIRMED by the driver. Be ready at your pickup point.`,
        type: "trip_confirmed",
        isRead: false,
      });
    }
  }

  res.json(formatTrip(trip));
});

// ─── Driver: cancel a trip (emergency override) ───────────────────────────────
router.post("/driver/trips/:id/cancel", requireAuth, requireRole("driver", "admin"), async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid trip ID" }); return; }

  const [trip] = await db
    .update(tripsTable)
    .set({ status: "canceled" })
    .where(eq(tripsTable.id, id))
    .returning();

  if (!trip) { res.status(404).json({ error: "Trip not found" }); return; }

  const affectedBookings = await db
    .select()
    .from(bookingsTable)
    .where(and(eq(bookingsTable.tripId, id), sql`${bookingsTable.status} != 'canceled'`));

  if (affectedBookings.length > 0) {
    await db
      .update(bookingsTable)
      .set({ status: "canceled" })
      .where(eq(bookingsTable.tripId, id));

    await db
      .update(tripsTable)
      .set({ bookedSeats: 0 })
      .where(eq(tripsTable.id, id));

    for (const booking of affectedBookings) {
      await db.insert(notificationsTable).values({
        userId: booking.userId,
        message: `Your shuttle booking for ${trip.date} at ${trip.departureTime} has been CANCELED by the driver.`,
        type: "trip_canceled",
        isRead: false,
      });
    }
  }

  res.json(formatTrip(trip));
});

router.get("/pickup-points", requireAuth, async (_req, res): Promise<void> => {
  const points = await db.select().from(pickupPointsTable).orderBy(pickupPointsTable.routeOrder);
  res.json(points);
});

router.post("/admin/pickup-points", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const { name, lat, lng } = req.body;
  const cleanName = typeof name === "string" ? name.trim() : "";
  const parsedLat = Number(lat);
  const parsedLng = Number(lng);

  // Validate coordinates server-side so only usable map pins become official terminals.
  if (!cleanName || !Number.isFinite(parsedLat) || !Number.isFinite(parsedLng)) {
    res.status(400).json({ error: "Name, latitude, and longitude are required." });
    return;
  }

  // New terminals are appended to the existing route order for predictable marker ordering.
  const existing = await db.select().from(pickupPointsTable);
  const nextRouteOrder = existing.reduce((max, point) => Math.max(max, point.routeOrder), 0) + 1;

  const [point] = await db
    .insert(pickupPointsTable)
    .values({
      name: cleanName,
      lat: parsedLat,
      lng: parsedLng,
      routeOrder: nextRouteOrder,
    })
    .returning();

  res.status(201).json(point);
});

router.delete("/admin/pickup-points/:id", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const id = Number(req.params.id);

  // Reject invalid IDs before touching the database.
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid pickup terminal ID." });
    return;
  }

  const [point] = await db.select().from(pickupPointsTable).where(eq(pickupPointsTable.id, id));
  if (!point) {
    res.status(404).json({ error: "Pickup terminal not found." });
    return;
  }

  await db.delete(pickupPointsTable).where(eq(pickupPointsTable.id, id));
  res.json({ success: true });
});

function getTomorrow(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
}

export default router;
