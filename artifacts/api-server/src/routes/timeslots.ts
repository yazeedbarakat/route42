import { Router, type IRouter } from "express";
import { db, timeSlotsTable, usersTable, notificationsTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth";

const router: IRouter = Router();

const TIME_FORMAT_RE = /^(0?[1-9]|1[0-2]):[0-5]\d\s?(AM|PM)$/i;

function normalise(t: string): string {
  return t.trim().replace(/\s+/g, " ").toUpperCase();
}

function isValidTimeString(t: string): boolean {
  return TIME_FORMAT_RE.test(t.trim());
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

router.get("/timeslots", requireAuth, async (_req, res): Promise<void> => {
  const slots = await db
    .select()
    .from(timeSlotsTable)
    .where(eq(timeSlotsTable.isActive, true))
    .orderBy(asc(timeSlotsTable.id));

  res.json(slots.map(s => ({
    id: s.id,
    timeString: s.timeString,
    isActive: s.isActive,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  })));
});

router.post("/admin/timeslots", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const raw: unknown = (req.body as Record<string, unknown>)?.timeString;

  if (typeof raw !== "string" || !raw.trim()) {
    res.status(400).json({ error: "timeString is required." });
    return;
  }

  const timeString = normalise(raw);

  if (!isValidTimeString(timeString)) {
    res.status(400).json({ error: "Invalid time format. Use 'HH:MM AM' or 'HH:MM PM' (e.g. '08:00 AM')." });
    return;
  }

  const [existing] = await db
    .select()
    .from(timeSlotsTable)
    .where(eq(timeSlotsTable.timeString, timeString));

  if (existing) {
    res.status(400).json({ error: `Time slot '${timeString}' already exists.` });
    return;
  }

  const [created] = await db
    .insert(timeSlotsTable)
    .values({ timeString, isActive: true })
    .returning();

  await broadcastScheduleNotification().catch(() => {});

  res.status(201).json({
    id: created.id,
    timeString: created.timeString,
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
