import { Router, type IRouter } from "express";
import { db, timeSlotsTable, usersTable, notificationsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
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

  const [deleted] = await db
    .delete(timeSlotsTable)
    .where(eq(timeSlotsTable.id, id))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Time slot not found." });
    return;
  }

  await broadcastScheduleNotification().catch(() => {});

  res.json({ success: true, id: deleted.id });
});

export default router;
