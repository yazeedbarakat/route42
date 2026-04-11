import { pgTable, text, serial, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("student"),
  phone: text("phone"),
  // Optional username for credential-based login (s1–s6, admin, etc.)
  username: text("username").unique(),
  // Google OAuth ID — set when a student registers via Google
  googleId: text("google_id").unique(),
  // False while a Google OAuth student is completing their profile setup
  profileComplete: boolean("profile_complete").notNull().default(true),
  // Unique driver identifier — set only for driver accounts created by admin.
  // Drivers authenticate with this ID alone (no email/password required).
  driverId: text("driver_id").unique(),
  // Base64-encoded profile picture (data URI). Stored directly in DB for simplicity.
  profilePicture: text("profile_picture"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
