import app from "./app";
import { logger } from "./lib/logger";
import { db, usersTable } from "@workspace/db";
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
    logger.info("Demo credentials are ready");
  } catch (seedErr) {
    logger.warn({ seedErr }, "Demo credential seed skipped (non-fatal)");
  }
});
