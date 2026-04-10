import app from "./app";
import { logger } from "./lib/logger";
import { db, usersTable } from "@workspace/db";
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

  // Seed demo driver: ensure the existing demo driver account has driverId = "DRV-001"
  // so the Driver ID login path works out of the box in development/demo mode.
  try {
    const [demoDriver] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, "driver@42irbid.com"));

    if (demoDriver && !demoDriver.driverId) {
      await db
        .update(usersTable)
        .set({ driverId: "DRV-001" })
        .where(eq(usersTable.id, demoDriver.id));
      logger.info("Seeded demo driver with driverId: DRV-001");
    }
  } catch (seedErr) {
    logger.warn({ seedErr }, "Demo driver seed skipped (non-fatal)");
  }
});
