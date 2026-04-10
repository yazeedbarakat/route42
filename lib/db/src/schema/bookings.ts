import { pgTable, text, serial, integer, timestamp, doublePrecision } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { tripsTable } from "./trips";
import { pickupPointsTable } from "./pickup-points";

export const bookingsTable = pgTable("bookings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  tripId: integer("trip_id").notNull().references(() => tripsTable.id),
  pickupPointId: integer("pickup_point_id").references(() => pickupPointsTable.id), // nullable — not used for custom pickups
  pickupType: text("pickup_type").notNull().default("custom"),   // "custom" | "fixed"
  pickupName: text("pickup_name"),                               // terminal name for fixed pickups
  customLat: doublePrecision("custom_lat"),                      // coordinate for custom pickups
  customLng: doublePrecision("custom_lng"),
  status: text("status").notNull().default("pending"), // pending, confirmed, canceled, waiting
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertBookingSchema = createInsertSchema(bookingsTable).omit({ id: true, createdAt: true });
export type InsertBooking = z.infer<typeof insertBookingSchema>;
export type Booking = typeof bookingsTable.$inferSelect;
