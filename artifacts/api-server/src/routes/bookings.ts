import { Router, type IRouter } from "express";
import { db, bookingsTable, tripsTable, pickupPointsTable, usersTable, notificationsTable } from "@workspace/db";
import { eq, and, desc, asc } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth";
import {
  CreateBookingBody,
  GetBookingsQueryParams,
  GetAdminBookingsQueryParams,
  CancelBookingParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

const MAX_CAPACITY = 15;

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

  return {
    id: booking.id,
    userId: booking.userId,
    tripId: booking.tripId,
    pickupPointId: booking.pickupPointId,
    status: booking.status,
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

  // Find the earliest "waiting" booking for this trip
  const [firstWaiting] = await db
    .select()
    .from(bookingsTable)
    .where(and(eq(bookingsTable.tripId, tripId), eq(bookingsTable.status, "waiting")))
    .orderBy(asc(bookingsTable.createdAt))
    .limit(1);

  if (!firstWaiting) return;

  // Determine promoted status
  const newStatus = trip.bookedSeats >= trip.minBookingsToConfirm ? "confirmed" : "pending";

  await db
    .update(bookingsTable)
    .set({ status: newStatus })
    .where(eq(bookingsTable.id, firstWaiting.id));

  // Increment seat count
  await db
    .update(tripsTable)
    .set({ bookedSeats: trip.bookedSeats + 1 })
    .where(eq(tripsTable.id, tripId));

  await sendNotification(
    firstWaiting.userId,
    `Your ride is confirmed! A seat opened up for the ${trip.date} ${trip.departureTime} shuttle. You've been moved from the waiting list.`,
    "booking_update"
  );
}

router.get("/bookings", requireAuth, async (req, res): Promise<void> => {
  const parsed = GetBookingsQueryParams.safeParse(req.query);

  let query = db
    .select()
    .from(bookingsTable)
    .where(eq(bookingsTable.userId, req.user!.userId))
    .orderBy(desc(bookingsTable.createdAt))
    .$dynamic();

  const bookings = await query;
  const result = [];
  for (const b of bookings) {
    result.push(await formatBooking(b));
  }
  res.json(result);
});

router.get("/bookings/history", requireAuth, async (req, res): Promise<void> => {
  const bookings = await db
    .select()
    .from(bookingsTable)
    .where(eq(bookingsTable.userId, req.user!.userId))
    .orderBy(desc(bookingsTable.createdAt));

  const result = [];
  for (const b of bookings) {
    result.push(await formatBooking(b));
  }
  res.json(result);
});

router.post("/bookings", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateBookingBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { tripId, pickupType, pickupPointId, pickupName, customLat, customLng } = parsed.data;

  // Check trip exists
  const [trip] = await db.select().from(tripsTable).where(eq(tripsTable.id, tripId));
  if (!trip) {
    res.status(400).json({ error: "Trip not found" });
    return;
  }
  if (trip.status === "canceled") {
    res.status(400).json({ error: "Cannot book a canceled trip" });
    return;
  }

  // Check if user already has an active booking for this trip
  const [existing] = await db
    .select()
    .from(bookingsTable)
    .where(
      and(
        eq(bookingsTable.userId, req.user!.userId),
        eq(bookingsTable.tripId, tripId)
      )
    );

  if (existing && existing.status !== "canceled") {
    res.status(400).json({ error: "You already have a booking for this trip" });
    return;
  }

  // Resolve pickup: for "fixed" validate the DB record; for "custom" accept lat/lng directly
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
    // custom — coordinates must be provided
    if (customLat == null || customLng == null) {
      res.status(400).json({ error: "customLat and customLng are required for custom pickup" });
      return;
    }
  }

  // Determine status: waiting list if at or over MAX_CAPACITY
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
    // Increment seat count only for active (non-waiting) bookings
    const newBookedSeats = trip.bookedSeats + 1;
    await db
      .update(tripsTable)
      .set({ bookedSeats: newBookedSeats })
      .where(eq(tripsTable.id, tripId));

    // Auto-confirm trip if minimum bookings reached
    if (newBookedSeats >= trip.minBookingsToConfirm && trip.status === "pending") {
      await db
        .update(tripsTable)
        .set({ status: "confirmed" })
        .where(eq(tripsTable.id, tripId));

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
          "trip_confirmed"
        );
      }
    }

    if (isWaiting === false && bookingStatus === "pending") {
      await sendNotification(
        req.user!.userId,
        `Booking received for ${trip.date} at ${trip.departureTime}. You're on the list — trip confirms when enough riders join.`,
        "booking_update"
      );
    }
  } else {
    // Notify the user they are on the waiting list
    await sendNotification(
      req.user!.userId,
      `You're on the waiting list for ${trip.date} at ${trip.departureTime}. We'll notify you immediately if a seat opens up.`,
      "booking_update"
    );
  }

  const [freshBooking] = await db.select().from(bookingsTable).where(eq(bookingsTable.id, booking.id));
  res.status(201).json(await formatBooking(freshBooking));
});

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

router.delete("/bookings/:id", requireAuth, async (req, res): Promise<void> => {
  const params = CancelBookingParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [booking] = await db.select().from(bookingsTable).where(eq(bookingsTable.id, params.data.id));
  if (!booking) {
    res.status(404).json({ error: "Booking not found" });
    return;
  }
  if (booking.userId !== req.user!.userId && req.user!.role !== "admin") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  if (booking.status === "canceled") {
    res.status(400).json({ error: "Booking is already canceled" });
    return;
  }

  const wasActive = booking.status !== "waiting";

  const [updated] = await db
    .update(bookingsTable)
    .set({ status: "canceled" })
    .where(eq(bookingsTable.id, params.data.id))
    .returning();

  if (wasActive) {
    // Decrement seat count and promote next waiting user (FIFO)
    const [trip] = await db.select().from(tripsTable).where(eq(tripsTable.id, booking.tripId));
    if (trip) {
      await db
        .update(tripsTable)
        .set({ bookedSeats: Math.max(0, trip.bookedSeats - 1) })
        .where(eq(tripsTable.id, booking.tripId));

      await promoteWaitingBooking(booking.tripId);
    }
  }

  res.json(await formatBooking(updated));
});

// Admin-only bookings view
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
  for (const b of allBookings) {
    result.push(await formatBooking(b));
  }
  res.json(result);
});

export default router;
