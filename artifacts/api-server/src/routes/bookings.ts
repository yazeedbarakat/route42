import { Router, type IRouter } from "express";
import { db, bookingsTable, tripsTable, pickupPointsTable, usersTable, notificationsTable } from "@workspace/db";
import { eq, and, desc, asc, ne, lte, sql } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth";
import {
  CreateBookingBody,
  GetBookingsQueryParams,
  GetAdminBookingsQueryParams,
  CancelBookingParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

const MAX_CAPACITY = 15;
const CANCEL_WINDOW_MINUTES = 15;

// ─── Jordan timezone helpers ──────────────────────────────────────────────────
function getJordanDateISO(offsetDays = 0): string {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Amman" }).format(new Date());
  if (offsetDays === 0) return today;
  const base = new Date(`${today}T12:00:00Z`);
  base.setUTCDate(base.getUTCDate() + offsetDays);
  return base.toISOString().split("T")[0];
}

function isAllowedJordanDate(date: string): boolean {
  return date === getJordanDateISO(0) || date === getJordanDateISO(1);
}

/**
 * Convert a trip's date + departureTime strings (Jordan local) into a UTC timestamp.
 * departureTime is in "HH:MM AM/PM" format, date is "YYYY-MM-DD" (Jordan calendar).
 */
function departureToUtcMs(dateStr: string, departureTimeStr: string): number {
  const match = departureTimeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return NaN;

  let h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  const meridiem = match[3].toUpperCase();
  if (meridiem === "PM" && h !== 12) h += 12;
  if (meridiem === "AM" && h === 12) h = 0;

  // Determine Jordan's UTC offset on the trip date by checking noon UTC
  const [year, month, day] = dateStr.split("-").map(Number);
  const refDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));

  const jordanNoonHour = parseInt(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Amman",
      hour: "numeric",
      hour12: false,
    }).format(refDate),
    10,
  );
  const jordanOffsetHours = jordanNoonHour - 12; // e.g. 2 for UTC+2, 3 for UTC+3

  // Jordan departure local → UTC
  const utcH = h - jordanOffsetHours;
  return Date.UTC(year, month - 1, day, utcH, m, 0);
}

/**
 * Returns true if the student is still within the cancellation window
 * (departure is ≥ 15 minutes from now in Jordan time).
 */
function isCancellationAllowed(trip: { date: string; departureTime: string }): boolean {
  const nowMs = Date.now();
  const departureMs = departureToUtcMs(trip.date, trip.departureTime);
  if (isNaN(departureMs)) return true; // allow if unparseable (fail open)
  const minutesUntilDeparture = (departureMs - nowMs) / 60_000;
  return minutesUntilDeparture >= CANCEL_WINDOW_MINUTES;
}

// ─── Mock notification sender ────────────────────────────────────────────────
async function sendNotification(userId: number, message: string, type = "booking_update") {
  await db.insert(notificationsTable).values({
    userId,
    message,
    type,
    isRead: false,
  });
}

async function formatBooking(booking: typeof bookingsTable.$inferSelect) {
  const [trip] = await db.select().from(tripsTable).where(eq(tripsTable.id, booking.tripId));
  const [pickupPoint] = booking.pickupPointId
    ? await db.select().from(pickupPointsTable).where(eq(pickupPointsTable.id, booking.pickupPointId))
    : [undefined];
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, booking.userId));

  let waitlistPosition: number | null = null;
  if (booking.status === "waiting") {
    const posResult = await db
      .select({ cnt: sql<number>`count(*)::int` })
      .from(bookingsTable)
      .where(and(
        eq(bookingsTable.tripId, booking.tripId),
        eq(bookingsTable.status, "waiting"),
        lte(bookingsTable.id, booking.id),
      ));
    waitlistPosition = posResult[0]?.cnt ?? null;
  }

  return {
    id: booking.id,
    userId: booking.userId,
    tripId: booking.tripId,
    pickupPointId: booking.pickupPointId,
    pickupType: booking.pickupType,
    pickupName: booking.pickupName,
    customLat: booking.customLat,
    customLng: booking.customLng,
    status: booking.status,
    waitlistPosition,
    createdAt: booking.createdAt.toISOString(),
    trip: trip ? {
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
    } : undefined,
    pickupPoint: pickupPoint ? {
      id: pickupPoint.id,
      name: pickupPoint.name,
      lat: pickupPoint.lat,
      lng: pickupPoint.lng,
      routeOrder: pickupPoint.routeOrder,
    } : undefined,
    user: user ? {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt.toISOString(),
    } : undefined,
  };
}

// ─── Promote first waiting booking for a trip (FIFO) ─────────────────────────
async function promoteWaitingBooking(tripId: number) {
  const [trip] = await db.select().from(tripsTable).where(eq(tripsTable.id, tripId));
  if (!trip) return;

  const [firstWaiting] = await db
    .select()
    .from(bookingsTable)
    .where(and(eq(bookingsTable.tripId, tripId), eq(bookingsTable.status, "waiting")))
    .orderBy(asc(bookingsTable.createdAt))
    .limit(1);

  if (!firstWaiting) return;

  const newStatus = trip.bookedSeats >= trip.minBookingsToConfirm ? "confirmed" : "pending";

  await db
    .update(bookingsTable)
    .set({ status: newStatus })
    .where(eq(bookingsTable.id, firstWaiting.id));

  await db
    .update(tripsTable)
    .set({ bookedSeats: trip.bookedSeats + 1 })
    .where(eq(tripsTable.id, tripId));

  await sendNotification(
    firstWaiting.userId,
    `Great news! A seat opened up and your waitlisted ride for ${trip.departureTime} is now Confirmed. Head to 'My Ride' for details.`,
    "trip_confirmed",
  );
}

// ─── Shared cancel logic ──────────────────────────────────────────────────────
async function performCancel(
  bookingId: number,
  requestingUserId: number,
  requestingRole: string,
  res: any,
): Promise<void> {
  const [booking] = await db.select().from(bookingsTable).where(eq(bookingsTable.id, bookingId));
  if (!booking) {
    res.status(404).json({ error: "Booking not found" });
    return;
  }
  if (booking.userId !== requestingUserId && requestingRole !== "admin") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  if (booking.status === "canceled") {
    res.status(400).json({ error: "Booking is already canceled" });
    return;
  }

  // ── 15-minute cancellation window check (students only) ───────────────────
  if (requestingRole === "student") {
    const [trip] = await db.select().from(tripsTable).where(eq(tripsTable.id, booking.tripId));
    if (trip && !isCancellationAllowed(trip)) {
      res.status(400).json({
        error: "Cancellation window closed. You can only cancel up to 15 minutes before departure.",
      });
      return;
    }
  }

  const wasActive = booking.status !== "waiting";

  const [updated] = await db
    .update(bookingsTable)
    .set({ status: "canceled" })
    .where(eq(bookingsTable.id, bookingId))
    .returning();

  if (wasActive) {
    const [trip] = await db.select().from(tripsTable).where(eq(tripsTable.id, booking.tripId));
    if (trip) {
      await db
        .update(tripsTable)
        .set({ bookedSeats: Math.max(0, trip.bookedSeats - 1) })
        .where(eq(tripsTable.id, booking.tripId));

      await promoteWaitingBooking(booking.tripId);

      // Notify the assigned driver if the trip was confirmed and a driver exists
      const driver = await db
        .select()
        .from(usersTable)
        .where(and(eq(usersTable.role, "driver")));

      if (driver.length > 0 && trip.status === "confirmed") {
        for (const d of driver) {
          await sendNotification(
            d.id,
            `A student cancelled their booking for the ${trip.date} ${trip.departureTime} trip. Seat count updated.`,
            "booking_update",
          );
        }
      }
    }
  }

  res.json(await formatBooking(updated));
}

// ─── GET /bookings ────────────────────────────────────────────────────────────
router.get("/bookings", requireAuth, async (req, res): Promise<void> => {
  GetBookingsQueryParams.safeParse(req.query);

  const bookings = await db
    .select()
    .from(bookingsTable)
    .where(eq(bookingsTable.userId, req.user!.userId))
    .orderBy(desc(bookingsTable.createdAt));

  const result = [];
  for (const b of bookings) result.push(await formatBooking(b));
  res.json(result);
});

// ─── GET /bookings/history ────────────────────────────────────────────────────
router.get("/bookings/history", requireAuth, async (req, res): Promise<void> => {
  const bookings = await db
    .select()
    .from(bookingsTable)
    .where(eq(bookingsTable.userId, req.user!.userId))
    .orderBy(desc(bookingsTable.createdAt));

  const result = [];
  for (const b of bookings) result.push(await formatBooking(b));
  res.json(result);
});

// ─── POST /bookings ───────────────────────────────────────────────────────────
router.post("/bookings", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateBookingBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { tripId, pickupType, pickupPointId, pickupName, customLat, customLng } = parsed.data;

  const [trip] = await db.select().from(tripsTable).where(eq(tripsTable.id, tripId));
  if (!trip) {
    res.status(400).json({ error: "Trip not found" });
    return;
  }
  if (trip.status === "canceled") {
    res.status(400).json({ error: "Cannot book a canceled trip" });
    return;
  }

  if (!isAllowedJordanDate(trip.date)) {
    res.status(400).json({ error: "Bookings are only allowed for today or tomorrow (Jordan timezone, Asia/Amman)." });
    return;
  }

  const [existing] = await db
    .select()
    .from(bookingsTable)
    .where(and(eq(bookingsTable.userId, req.user!.userId), eq(bookingsTable.tripId, tripId)));

  if (existing && existing.status !== "canceled") {
    res.status(400).json({ error: "You already have a booking for this trip" });
    return;
  }

  const conflictingRows = await db
    .select({ status: bookingsTable.status })
    .from(bookingsTable)
    .innerJoin(tripsTable, eq(bookingsTable.tripId, tripsTable.id))
    .where(
      and(
        eq(bookingsTable.userId, req.user!.userId),
        eq(tripsTable.date, trip.date),
        eq(tripsTable.direction, trip.direction),
        ne(bookingsTable.status, "canceled"),
      ),
    );

  if (conflictingRows.length > 0) {
    const dirLabel = trip.direction === "to_school" ? "Inbound (Go to 42 Irbid)" : "Outbound (Return from 42 Irbid)";
    res.status(400).json({
      error: `Duplicate booking detected for this direction on this date. You already have an active ${dirLabel} booking for ${trip.date}.`,
    });
    return;
  }

  let resolvedPickupPointId: number | null = null;
  if (pickupType === "fixed") {
    if (!pickupPointId) {
      res.status(400).json({ error: "pickupPointId is required for fixed pickup" });
      return;
    }
    const [pickupPoint] = await db.select().from(pickupPointsTable).where(eq(pickupPointsTable.id, pickupPointId));
    if (!pickupPoint) {
      res.status(400).json({ error: "Pickup point not found" });
      return;
    }
    resolvedPickupPointId = pickupPointId;
  } else {
    if (customLat == null || customLng == null) {
      res.status(400).json({ error: "customLat and customLng are required for custom pickup" });
      return;
    }
  }

  const isWaiting = trip.bookedSeats >= MAX_CAPACITY;
  const bookingStatus = isWaiting ? "waiting" : "pending";

  const [booking] = await db
    .insert(bookingsTable)
    .values({
      userId: req.user!.userId,
      tripId,
      pickupPointId: resolvedPickupPointId,
      pickupType: pickupType ?? "custom",
      pickupName: pickupName ?? null,
      customLat: customLat ?? null,
      customLng: customLng ?? null,
      status: bookingStatus,
    })
    .returning();

  if (!isWaiting) {
    const newBookedSeats = trip.bookedSeats + 1;
    await db
      .update(tripsTable)
      .set({ bookedSeats: newBookedSeats })
      .where(eq(tripsTable.id, tripId));

    if (newBookedSeats >= trip.minBookingsToConfirm) {
      if (trip.status === "pending") {
        await db
          .update(tripsTable)
          .set({ status: "confirmed" })
          .where(eq(tripsTable.id, tripId));
      }

      const pendingBookings = await db
        .select()
        .from(bookingsTable)
        .where(and(eq(bookingsTable.tripId, tripId), eq(bookingsTable.status, "pending")));

      await db
        .update(bookingsTable)
        .set({ status: "confirmed" })
        .where(and(eq(bookingsTable.tripId, tripId), eq(bookingsTable.status, "pending")));

      for (const pb of pendingBookings) {
        await sendNotification(
          pb.userId,
          `TRIP CONFIRMED: Your shuttle booking for ${trip.date} at ${trip.departureTime} is now confirmed. Be at your pickup point on time.`,
          "trip_confirmed",
        );
      }
    } else {
      await sendNotification(
        req.user!.userId,
        `Booking received for ${trip.date} at ${trip.departureTime}. You're on the list — trip confirms when enough riders join.`,
        "booking_update",
      );
    }
  } else {
    await sendNotification(
      req.user!.userId,
      `You're on the waiting list for ${trip.date} at ${trip.departureTime}. We'll notify you immediately if a seat opens up.`,
      "booking_update",
    );
  }

  const [freshBooking] = await db.select().from(bookingsTable).where(eq(bookingsTable.id, booking.id));
  res.status(201).json(await formatBooking(freshBooking));
});

// ─── GET /bookings/:id ────────────────────────────────────────────────────────
router.get("/bookings/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid booking ID" });
    return;
  }

  const [booking] = await db.select().from(bookingsTable).where(eq(bookingsTable.id, id));
  if (!booking) {
    res.status(404).json({ error: "Booking not found" });
    return;
  }
  if (booking.userId !== req.user!.userId && req.user!.role !== "admin") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  res.json(await formatBooking(booking));
});

// ─── PATCH /bookings/:id/cancel — student self-cancel with 15-min window ─────
router.patch("/bookings/:id/cancel", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid booking ID" });
    return;
  }
  await performCancel(id, req.user!.userId, req.user!.role, res);
});

// ─── DELETE /bookings/:id — legacy cancel (keeps backward compat) ─────────────
router.delete("/bookings/:id", requireAuth, async (req, res): Promise<void> => {
  const params = CancelBookingParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await performCancel(params.data.id, req.user!.userId, req.user!.role, res);
});

// ─── Admin bookings view ──────────────────────────────────────────────────────
router.get("/admin/bookings", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const parsed = GetAdminBookingsQueryParams.safeParse(req.query);

  let allBookings = await db
    .select()
    .from(bookingsTable)
    .orderBy(desc(bookingsTable.createdAt));

  if (parsed.success && parsed.data.status) {
    allBookings = allBookings.filter(b => b.status === parsed.data.status);
  }

  const result = [];
  for (const b of allBookings) result.push(await formatBooking(b));
  res.json(result);
});

export default router;
