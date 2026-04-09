import { Router, type IRouter } from "express";
import { db, bookingsTable, tripsTable, pickupPointsTable, usersTable, notificationsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth";
import {
  CreateBookingBody,
  GetBookingsQueryParams,
  GetAdminBookingsQueryParams,
  CancelBookingParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

async function formatBooking(booking: typeof bookingsTable.$inferSelect) {
  const [trip] = await db.select().from(tripsTable).where(eq(tripsTable.id, booking.tripId));
  const [pickupPoint] = await db.select().from(pickupPointsTable).where(eq(pickupPointsTable.id, booking.pickupPointId));
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

  const { tripId, pickupPointId } = parsed.data;

  // Check trip exists and has available seats
  const [trip] = await db.select().from(tripsTable).where(eq(tripsTable.id, tripId));
  if (!trip) {
    res.status(400).json({ error: "Trip not found" });
    return;
  }
  if (trip.status === "canceled") {
    res.status(400).json({ error: "Cannot book a canceled trip" });
    return;
  }
  if (trip.bookedSeats >= trip.totalSeats) {
    res.status(400).json({ error: "No available seats" });
    return;
  }

  // Check if user already booked this trip
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

  // Check pickup point exists
  const [pickupPoint] = await db.select().from(pickupPointsTable).where(eq(pickupPointsTable.id, pickupPointId));
  if (!pickupPoint) {
    res.status(400).json({ error: "Pickup point not found" });
    return;
  }

  // Create booking
  const [booking] = await db
    .insert(bookingsTable)
    .values({
      userId: req.user!.userId,
      tripId,
      pickupPointId,
      status: "pending",
    })
    .returning();

  // Update seat count
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

    // Confirm all pending bookings for this trip
    const pendingBookings = await db
      .select()
      .from(bookingsTable)
      .where(and(eq(bookingsTable.tripId, tripId), eq(bookingsTable.status, "pending")));

    await db
      .update(bookingsTable)
      .set({ status: "confirmed" })
      .where(and(eq(bookingsTable.tripId, tripId), eq(bookingsTable.status, "pending")));

    // Notify all students
    for (const pb of pendingBookings) {
      await db.insert(notificationsTable).values({
        userId: pb.userId,
        message: `TRIP CONFIRMED: Your shuttle booking for ${trip.date} at ${trip.departureTime} is now confirmed. Be at your pickup point on time.`,
        type: "trip_confirmed",
        isRead: false,
      });
    }
  }

  // Reload updated booking
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

  const [updated] = await db
    .update(bookingsTable)
    .set({ status: "canceled" })
    .where(eq(bookingsTable.id, params.data.id))
    .returning();

  // Update seat count
  await db
    .update(tripsTable)
    .set({ bookedSeats: Math.max(0, (await db.select().from(tripsTable).where(eq(tripsTable.id, booking.tripId)))[0]?.bookedSeats - 1) })
    .where(eq(tripsTable.id, booking.tripId));

  res.json(await formatBooking(updated));
});

// Admin-only bookings view
router.get("/admin/bookings", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const parsed = GetAdminBookingsQueryParams.safeParse(req.query);

  let allBookings = await db
    .select()
    .from(bookingsTable)
    .orderBy(desc(bookingsTable.createdAt));

  // Filter by status
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
