import { pgTable, text, serial, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const timeSlotsTable = pgTable("time_slots", {
  id: serial("id").primaryKey(),
  timeString: text("time_string").notNull(),
  direction: text("direction").notNull().default("inbound"), // "inbound" | "outbound"
  date: text("date").notNull().default(""),                 // YYYY-MM-DD
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertTimeSlotSchema = createInsertSchema(timeSlotsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertTimeSlot = z.infer<typeof insertTimeSlotSchema>;
export type TimeSlot = typeof timeSlotsTable.$inferSelect;
