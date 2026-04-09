import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const tripsTable = pgTable("trips", {
  id: serial("id").primaryKey(),
  date: text("date").notNull(), // YYYY-MM-DD
  departureTime: text("departure_time").notNull(), // HH:MM
  status: text("status").notNull().default("pending"), // pending, confirmed, canceled
  totalSeats: integer("total_seats").notNull().default(15),
  bookedSeats: integer("booked_seats").notNull().default(0),
  minBookingsToConfirm: integer("min_bookings_to_confirm").notNull().default(5),
  direction: text("direction").notNull().default("to_school"), // to_school, from_school
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertTripSchema = createInsertSchema(tripsTable).omit({ id: true, createdAt: true });
export type InsertTrip = z.infer<typeof insertTripSchema>;
export type Trip = typeof tripsTable.$inferSelect;
