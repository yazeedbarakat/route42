import app from "./app";
import { logger } from "./lib/logger";
import { db, pickupPointsTable, usersTable, timeSlotsTable } from "@workspace/db";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, async (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  // Keep demo credentials usable after database resets or stale seed data.
  try {
    const demoUsers = [
      {
        name: "Admin User",
        email: "admin@42irbid.com",
        password: "admin123",
        role: "admin",
        phone: null,
        driverId: null,
      },
      {
        name: "Demo Driver",
        email: "driver@42irbid.com",
        password: "driver123",
        role: "driver",
        phone: "+962 7 0000 0001",
        driverId: "DRV-001",
      },
      {
        name: "Ali Student",
        email: "ali@learner.42.tech",
        password: "student123",
        role: "student",
        phone: null,
        driverId: null,
      },
    ];

    for (const demo of demoUsers) {
      const passwordHash = await bcrypt.hash(demo.password, 10);
      const [existingByEmail] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.email, demo.email));

      const [existingByDriverId] = demo.driverId
        ? await db
            .select()
            .from(usersTable)
            .where(eq(usersTable.driverId, demo.driverId))
        : [];

      const existing = existingByEmail ?? existingByDriverId;

      if (existing) {
        if (existingByEmail && existingByDriverId && existingByEmail.id !== existingByDriverId.id) {
          await db
            .update(usersTable)
            .set({ driverId: null })
            .where(eq(usersTable.id, existingByDriverId.id));
        }

        await db
          .update(usersTable)
          .set({
            name: demo.name,
            email: demo.email,
            passwordHash,
            role: demo.role,
            phone: demo.phone,
            driverId: demo.driverId,
          })
          .where(eq(usersTable.id, existing.id));
      } else {
        await db
          .insert(usersTable)
          .values({
            name: demo.name,
            email: demo.email,
            passwordHash,
            role: demo.role,
            phone: demo.phone,
            driverId: demo.driverId,
          });
      }
    }

    const [legacyStudent] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, "ali@42irbid.com"));

    if (legacyStudent) {
      await db
        .update(usersTable)
        .set({
          name: "Ali Student",
          passwordHash: await bcrypt.hash("student123", 10),
          role: "student",
          driverId: null,
        })
        .where(eq(usersTable.id, legacyStudent.id));
    }

    const defaultPickupTerminals = [
      { name: "Northern Terminal", lat: 32.568219717501016, lng: 35.85560315169505, routeOrder: 1 },
      { name: "Al-Ghour Terminal", lat: 32.5510273259837, lng: 35.838026446580656, routeOrder: 2 },
      { name: "Sheikh Khalil", lat: 32.55034219324052, lng: 35.85550052285881, routeOrder: 3 },
      { name: "Amman Terminal", lat: 32.535047165765235, lng: 35.869768897719915, routeOrder: 4 },
      { name: "دوار الدرة", lat: 32.55824371537429, lng: 35.87344062736422, routeOrder: 5 },
    ];

    const existingPickupTerminals = await db.select().from(pickupPointsTable);
    if (existingPickupTerminals.length === 0) {
      // Seed official pickup terminals so maps are database-backed immediately after a remix/reset.
      await db.insert(pickupPointsTable).values(defaultPickupTerminals);
    }

    // Seed default time slots if none exist yet.
    const existingSlots = await db.select().from(timeSlotsTable);
    if (existingSlots.length === 0) {
      const defaultSlots = [
        "08:00 AM", "10:00 AM", "12:00 PM",
        "01:00 PM", "02:00 PM", "03:00 PM",
        "04:00 PM", "05:00 PM", "06:00 PM", "07:00 PM",
      ];
      await db.insert(timeSlotsTable).values(
        defaultSlots.map(timeString => ({ timeString, isActive: true })),
      );
    }

    logger.info("Demo credentials are ready");
  } catch (seedErr) {
    logger.warn({ seedErr }, "Demo credential seed skipped (non-fatal)");
  }
});
