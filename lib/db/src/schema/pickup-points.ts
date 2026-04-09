import { pgTable, text, serial, real, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const pickupPointsTable = pgTable("pickup_points", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  lat: real("lat").notNull(),
  lng: real("lng").notNull(),
  routeOrder: integer("route_order").notNull(),
});

export const insertPickupPointSchema = createInsertSchema(pickupPointsTable).omit({ id: true });
export type InsertPickupPoint = z.infer<typeof insertPickupPointSchema>;
export type PickupPoint = typeof pickupPointsTable.$inferSelect;
