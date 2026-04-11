import { Router, type IRouter } from "express";
import { db, timeSlotsTable, tripsTable, bookingsTable, usersTable, notificationsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth";

const router: IRouter = Router();

const TIME_FORMAT_RE = /^(0?[1-9]|1[0-2]):[0-5]\d\s?(AM|PM)$/i;
const DIRECTION_VALUES = ["inbound", "outbound"] as const;

function normaliseTime(t: string): string {
  return t.trim().replace(/\s+/g, " ").toUpperCase();
}

function isValidTimeString(t: string): boolean {
  return TIME_FORMAT_RE.test(t.trim());
}

function isValidDirection(d: string): d is "inbound" | "outbound" {
  return DIRECTION_VALUES.includes(d as "inbound" | "outbound");
}

function isValidDate(d: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(d) && !isNaN(Date.parse(d));
}

// Jordan timezone (Asia/Amman, UTC+3) date helpers
function getJordanDateISO(offsetDays = 0): string {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Amman" }).format(new Date());
  if (offsetDays === 0) return today;
  const base = new Date(`${today}T12:00:00Z`);
  base.setUTCDate(base.getUTCDate() + offsetDays);
  return base.toISOString().split("T")[0];
}

function isAllowedJordanDate(date: string): boolean {
  const today = getJordanDateISO(0);
  const tomorrow = getJordanDateISO(1);
  return date === today || date === tomorrow;
}

// Timeslot direction → trip direction
function toTripDirection(slotDir: "inbound" | "outbound"): "to_school" | "from_school" {
  return slotDir === "inbound" ? "to_school" : "from_school";
}

// ─── Default schedule (matches trips.ts DEFAULT_SCHEDULE) ─────────────────────
const DEFAULT_TIMESLOT_SCHEDULE: { timeString: string; direction: "inbound" | "outbound" }[] = [
  { timeString: "08:00 AM", direction: "inbound"  },
  { timeString: "10:00 AM", direction: "inbound"  },
  { timeString: "12:00 PM", direction: "inbound"  },
  { timeString: "01:00 PM", direction: "outbound" },
  { timeString: "02:00 PM", direction: "inbound"  },
  { timeString: "03:00 PM", direction: "outbound" },
  { timeString: "04:00 PM", direction: "inbound"  },
  { timeString: "05:00 PM", direction: "outbound" },
  { timeString: "06:00 PM", direction: "inbound"  },
  { timeString: "07:00 PM", direction: "outbound" },
];

/**
 * Lazy-seed default timeslots (and their backing trips) for `date` if none exist yet.
 * Safe to call on every request — exits immediately when rows are already present.
 * Uses Asia/Amman as the source of truth for what constitutes today/tomorrow.
 */
async function seedTimeSlotsForDate(date: string): Promise<void> {
  // Guard: only seed for today or tomorrow (Jordan timezone)
  if (!isAllowedJordanDate(date)) return;

  // Check whether ANY timeslot row already exists for this date
  const [existing] = await db
    .select({ id: timeSlotsTable.id })
    .from(timeSlotsTable)
    .where(eq(timeSlotsTable.date, date))
    .limit(1);

  if (existing) return; // already seeded — nothing to do

  // Insert default timeslot rows
  await db.insert(timeSlotsTable).values(
    DEFAULT_TIMESLOT_SCHEDULE.map(s => ({
      timeString: s.timeString,
      direction:  s.direction,
      date,
      isActive: true,
    })),
  );

  // Ensure a matching trip row exists for each slot so students can actually book them.
  // We insert only where no row for (date, time, direction) already exists.
  for (const s of DEFAULT_TIMESLOT_SCHEDULE) {
    const tripDirection = toTripDirection(s.direction);
    const [existingTrip] = await db
      .select({ id: tripsTable.id })
      .from(tripsTable)
      .where(
        and(
          eq(tripsTable.date, date),
          eq(tripsTable.departureTime, s.timeString),
          eq(tripsTable.direction, tripDirection),
        ),
      );

    if (!existingTrip) {
      await db.insert(tripsTable).values({
        date,
        departureTime:        s.timeString,
        direction:            tripDirection,
        status:               "pending",
        totalSeats:           15,
        bookedSeats:          0,
        minBookingsToConfirm: 5,
      });
    }
  }
}

async function broadcastScheduleNotification(): Promise<void> {
  const students = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.role, "student"));

  if (students.length === 0) return;

  await db.insert(notificationsTable).values(
    students.map(s => ({
      userId: s.id,
      message: "The trip schedule has been updated by the Admin. Check the new available times!",
      type: "schedule_update",
      isRead: false,
    })),
  );
}

router.get("/timeslots", requireAuth, async (req, res): Promise<void> => {
  const { date, direction } = req.query as Record<string, string | undefined>;

  // Auto-seed default timeslots (and backing trips) for the requested date if none exist yet.
  // Only fires for valid today/tomorrow dates (Jordan timezone); exits instantly if rows exist.
  if (date && isValidDate(date)) {
    await seedTimeSlotsForDate(date);
  }

  let query = db.select().from(timeSlotsTable).$dynamic();

  const conditions = [eq(timeSlotsTable.isActive, true)];
  if (date) conditions.push(eq(timeSlotsTable.date, date));
  if (direction && isValidDirection(direction)) {
    conditions.push(eq(timeSlotsTable.direction, direction));
  }

  const slots = await query.where(and(...conditions));

  res.json(slots.map(s => ({
    id: s.id,
    timeString: s.timeString,
    direction: s.direction,
    date: s.date,
    isActive: s.isActive,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  })));
});

router.post("/admin/timeslots", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const body = req.body as Record<string, unknown>;
  const rawTime = body?.timeString;
  const rawDir  = body?.direction;
  const rawDate = body?.date;

  if (typeof rawTime !== "string" || !rawTime.trim()) {
    res.status(400).json({ error: "timeString is required." });
    return;
  }
  if (typeof rawDir !== "string" || !isValidDirection(rawDir)) {
    res.status(400).json({ error: "direction must be 'inbound' or 'outbound'." });
    return;
  }
  if (typeof rawDate !== "string" || !isValidDate(rawDate)) {
    res.status(400).json({ error: "date must be a valid YYYY-MM-DD string." });
    return;
  }

  if (!isAllowedJordanDate(rawDate)) {
    res.status(400).json({ error: "Date must be today or tomorrow (Jordan timezone, Asia/Amman). Scheduling beyond tomorrow is not allowed." });
    return;
  }

  const timeString = normaliseTime(rawTime);
  const direction  = rawDir as "inbound" | "outbound";
  const date       = rawDate;

  if (!isValidTimeString(timeString)) {
    res.status(400).json({ error: "Invalid time format. Use 'HH:MM AM' or 'HH:MM PM' (e.g. '08:00 AM')." });
    return;
  }

  const [existing] = await db
    .select()
    .from(timeSlotsTable)
    .where(
      and(
        eq(timeSlotsTable.timeString, timeString),
        eq(timeSlotsTable.direction, direction),
        eq(timeSlotsTable.date, date),
      ),
    );

  if (existing) {
    res.status(400).json({ error: `'${timeString}' already exists for this date and direction.` });
    return;
  }

  const [created] = await db
    .insert(timeSlotsTable)
    .values({ timeString, direction, date, isActive: true })
    .returning();

  // ── Bug 1 fix: ensure a matching trip exists so students can book it ──────
  const tripDirection = toTripDirection(direction);
  const [existingTrip] = await db
    .select()
    .from(tripsTable)
    .where(
      and(
        eq(tripsTable.date, date),
        eq(tripsTable.departureTime, timeString),
        eq(tripsTable.direction, tripDirection),
      ),
    );

  if (!existingTrip) {
    await db.insert(tripsTable).values({
      date,
      departureTime: timeString,
      direction: tripDirection,
      status: "pending",
      totalSeats: 15,
      bookedSeats: 0,
      minBookingsToConfirm: 5,
    });
  } else if (existingTrip.status === "canceled") {
    // Reactivate a previously-canceled trip for this slot
    await db
      .update(tripsTable)
      .set({ status: "pending" })
      .where(eq(tripsTable.id, existingTrip.id));
  }
  // ─────────────────────────────────────────────────────────────────────────

  await broadcastScheduleNotification().catch(() => {});

  res.status(201).json({
    id: created.id,
    timeString: created.timeString,
    direction: created.direction,
    date: created.date,
    isActive: created.isActive,
    createdAt: created.createdAt.toISOString(),
    updatedAt: created.updatedAt.toISOString(),
  });
});

router.delete("/admin/timeslots/:id", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);

  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id." });
    return;
  }

  const [slot] = await db.select().from(timeSlotsTable).where(eq(timeSlotsTable.id, id));
  if (!slot) {
    res.status(404).json({ error: "Time slot not found." });
    return;
  }

  // ── Bug 2 fix: cancel orphaned bookings before deleting the slot ──────────
  const tripDirection = toTripDirection(slot.direction as "inbound" | "outbound");

  const [linkedTrip] = await db
    .select()
    .from(tripsTable)
    .where(
      and(
        eq(tripsTable.date, slot.date),
        eq(tripsTable.departureTime, slot.timeString),
        eq(tripsTable.direction, tripDirection),
      ),
    );

  await db.transaction(async (tx) => {
    if (linkedTrip) {
      // Only target bookings that are still active (not already cancelled)
      const activeBookings = await tx
        .select()
        .from(bookingsTable)
        .where(
          and(
            eq(bookingsTable.tripId, linkedTrip.id),
            sql`${bookingsTable.status} NOT IN ('canceled', 'cancelled_by_admin')`,
          ),
        );

      if (activeBookings.length > 0) {
        // Cancel only the active bookings — do not touch already-cancelled ones
        await tx
          .update(bookingsTable)
          .set({ status: "cancelled_by_admin" })
          .where(
            and(
              eq(bookingsTable.tripId, linkedTrip.id),
              sql`${bookingsTable.status} NOT IN ('canceled', 'cancelled_by_admin')`,
            ),
          );

        // Notify every affected student with a personalised message
        const displayTime = slot.timeString;
        await tx.insert(notificationsTable).values(
          activeBookings.map(b => ({
            userId: b.userId,
            message: `Your scheduled ride at ${displayTime} on ${slot.date} has been cancelled by the administration. Please book a new time slot.`,
            type: "trip_canceled",
            isRead: false,
          })),
        );
      }

      // Mark the trip itself as canceled and reset seat count
      await tx
        .update(tripsTable)
        .set({ status: "canceled", bookedSeats: 0 })
        .where(eq(tripsTable.id, linkedTrip.id));
    }

    // Delete the timeslot inside the transaction so everything rolls back on failure
    await tx.delete(timeSlotsTable).where(eq(timeSlotsTable.id, id));
  });
  // ─────────────────────────────────────────────────────────────────────────

  await broadcastScheduleNotification().catch(() => {});

  res.json({ success: true, id });
});

export default router;
