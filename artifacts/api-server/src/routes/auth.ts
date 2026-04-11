import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { LoginBody, RegisterBody, DriverLoginBody, AddDriverBody } from "@workspace/api-zod";
import { signToken, requireAuth, requireRole } from "../lib/auth";
import { findTestAccount, getTestAccountById } from "../lib/test-accounts";

const router: IRouter = Router();

// ─── Standard email/password login (students & admins) ───────────────────────
router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { email, password } = parsed.data;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));

  if (!user) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const token = signToken({ userId: user.id, role: user.role, email: user.email });
  res.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt.toISOString(),
    },
    token,
  });
});

// ─── Driver ID login ──────────────────────────────────────────────────────────
// Drivers do not use email/password — they authenticate with their unique
// Driver ID that was assigned by an admin when the account was created.
router.post("/auth/driver-login", async (req, res): Promise<void> => {
  const parsed = DriverLoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Driver ID is required" });
    return;
  }

  const { driverId } = parsed.data;

  // Look up a user whose driverId matches AND whose role is 'driver'
  const [user] = await db
    .select()
    .from(usersTable)
    .where(and(eq(usersTable.driverId, driverId), eq(usersTable.role, "driver")));

  if (!user) {
    res.status(401).json({ error: "Invalid Driver ID" });
    return;
  }

  const token = signToken({ userId: user.id, role: user.role, email: user.email });
  res.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt.toISOString(),
    },
    token,
  });
});

// ─── TEST-ONLY: Hardcoded student quick-login ─────────────────────────────────
// Accepts { username, password } and matches against the TEST_ACCOUNTS table.
// Returns a JWT identical in shape to the real login response so the client
// treats it as a normal session. Delete this route + test-accounts.ts when
// replacing with a real auth system.
router.post("/auth/test-login", async (req, res): Promise<void> => {
  const { username, password } = req.body ?? {};

  if (typeof username !== "string" || typeof password !== "string") {
    res.status(400).json({ error: "username and password are required." });
    return;
  }

  const account = findTestAccount(username.trim(), password.trim());
  if (!account) {
    res.status(401).json({ error: "Invalid test credentials." });
    return;
  }

  const token = signToken({ userId: account.id, role: "student", email: account.email });
  res.json({
    user: {
      id: account.id,
      name: account.name,
      email: account.email,
      role: "student",
      createdAt: new Date().toISOString(),
    },
    token,
  });
});

// ─── Public self-registration (students & admins only) ───────────────────────
// Drivers are NOT allowed to self-register; they are created by admin only.
router.post("/auth/register", async (req, res): Promise<void> => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { name, email, password, role, phone } = parsed.data;

  // Prevent driver self-registration through the public endpoint
  if (role === "driver") {
    res.status(403).json({ error: "Driver accounts must be created by an administrator." });
    return;
  }

  const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (existing) {
    res.status(400).json({ error: "Email already registered" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const [user] = await db
    .insert(usersTable)
    .values({ name, email, passwordHash, role: role ?? "student", phone: phone ?? null })
    .returning();

  const token = signToken({ userId: user.id, role: user.role, email: user.email });
  res.status(201).json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt.toISOString(),
    },
    token,
  });
});

// ─── Admin: add a new driver account ─────────────────────────────────────────
// Only admins can create driver accounts. Drivers authenticate via Driver ID,
// so we auto-generate a placeholder email and a random password hash.
router.post(
  "/auth/admin/add-driver",
  requireAuth,
  requireRole("admin"),
  async (req, res): Promise<void> => {
    const parsed = AddDriverBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const { name, phone, driverId } = parsed.data;

    // Ensure the Driver ID is not already taken
    const [existingDriver] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.driverId, driverId));

    if (existingDriver) {
      res.status(400).json({ error: "A driver with this ID already exists." });
      return;
    }

    // Auto-generate a unique internal email (not exposed to the driver)
    const internalEmail = `driver_${driverId.toLowerCase().replace(/\s+/g, "_")}@internal.shuttle`;

    // Generate a random password hash — drivers never use this to log in
    const placeholderPasswordHash = await bcrypt.hash(
      `driver-${driverId}-${Date.now()}`,
      10,
    );

    const [user] = await db
      .insert(usersTable)
      .values({
        name,
        email: internalEmail,
        passwordHash: placeholderPasswordHash,
        role: "driver",
        phone,
        driverId,
      })
      .returning();

    res.status(201).json({
      success: true,
      driver: {
        id: user.id,
        name: user.name,
        driverId: user.driverId!,
        phone: user.phone ?? undefined,
      },
    });
  },
);

router.get(
  "/auth/admin/drivers",
  requireAuth,
  requireRole("admin"),
  async (_req, res): Promise<void> => {
    const drivers = await db
      .select({
        id: usersTable.id,
        name: usersTable.name,
        email: usersTable.email,
        phone: usersTable.phone,
        driverId: usersTable.driverId,
        createdAt: usersTable.createdAt,
      })
      .from(usersTable)
      .where(eq(usersTable.role, "driver"));

    res.json(drivers.map(driver => ({
      ...driver,
      createdAt: driver.createdAt.toISOString(),
    })));
  },
);

router.delete(
  "/auth/admin/drivers/:id",
  requireAuth,
  requireRole("admin"),
  async (req, res): Promise<void> => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: "Invalid driver ID" });
      return;
    }

    const [driver] = await db
      .select()
      .from(usersTable)
      .where(and(eq(usersTable.id, id), eq(usersTable.role, "driver")));

    if (!driver) {
      res.status(404).json({ error: "Driver not found" });
      return;
    }

    await db
      .delete(usersTable)
      .where(eq(usersTable.id, id));

    res.json({ success: true });
  },
);

router.post("/auth/logout", (_req, res): Promise<void> => {
  res.json({ success: true, message: "Logged out" });
  return Promise.resolve();
});

router.get("/auth/me", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;

  // TEST-ONLY: negative IDs belong to hardcoded test accounts — skip DB lookup.
  if (userId < 0) {
    const account = getTestAccountById(userId);
    if (!account) {
      res.status(401).json({ error: "Test account not found" });
      return;
    }
    res.json({
      id: account.id,
      name: account.name,
      email: account.email,
      role: "student",
      createdAt: new Date().toISOString(),
    });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) {
    res.status(401).json({ error: "User not found" });
    return;
  }
  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
  });
});

export default router;
