import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable } from "@workspace/db";
import { eq, or, and } from "drizzle-orm";
import { RegisterBody, DriverLoginBody, AddDriverBody } from "@workspace/api-zod";
import { signToken, signTempToken, verifyTempToken, requireAuth, requireRole } from "../lib/auth";
import { getTestAccountById } from "../lib/test-accounts";
import { z } from "zod";

const router: IRouter = Router();

const STUDENT_DOMAIN = "@learner.42.tech";

// ─── Google OAuth helpers ─────────────────────────────────────────────────────

function getGoogleRedirectUri(): string {
  const domain = process.env.REPLIT_DEV_DOMAIN ?? process.env.APP_DOMAIN;
  if (domain) return `https://${domain}/api/auth/google/callback`;
  return `http://localhost:${process.env.PORT ?? 8080}/api/auth/google/callback`;
}

async function exchangeCodeForProfile(code: string): Promise<{ id: string; email: string; name: string } | null> {
  const clientId     = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id:     clientId,
      client_secret: clientSecret,
      redirect_uri:  getGoogleRedirectUri(),
      grant_type:    "authorization_code",
    }),
  });

  if (!tokenRes.ok) return null;
  const tokenData = (await tokenRes.json()) as { access_token?: string };
  if (!tokenData.access_token) return null;

  const infoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  if (!infoRes.ok) return null;

  const info = (await infoRes.json()) as { sub?: string; email?: string; name?: string };
  if (!info.sub || !info.email) return null;
  return { id: info.sub, email: info.email, name: info.name ?? info.email };
}

function frontendUrl(path: string): string {
  const domain = process.env.REPLIT_DEV_DOMAIN ?? process.env.APP_DOMAIN;
  if (domain) return `https://${domain}${path}`;
  return `http://localhost:${process.env.PORT ?? 3000}${path}`;
}

// ─── Google OAuth — initiate ──────────────────────────────────────────────────
router.get("/auth/google", (req, res): void => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    res.status(503).json({ error: "Google OAuth is not configured." });
    return;
  }
  const params = new URLSearchParams({
    client_id:     clientId,
    redirect_uri:  getGoogleRedirectUri(),
    response_type: "code",
    scope:         "openid email profile",
    prompt:        "select_account",
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
});

// ─── Google OAuth — callback ──────────────────────────────────────────────────
router.get("/auth/google/callback", async (req, res): Promise<void> => {
  const code = req.query["code"] as string | undefined;
  if (!code) {
    res.redirect(frontendUrl("/?error=oauth_failed"));
    return;
  }

  const profile = await exchangeCodeForProfile(code);
  if (!profile) {
    res.redirect(frontendUrl("/?error=oauth_failed"));
    return;
  }

  // Domain restriction
  if (!profile.email.endsWith(STUDENT_DOMAIN)) {
    res.redirect(frontendUrl("/?error=unauthorized_domain"));
    return;
  }

  // Find existing user by googleId or email
  const [existing] = await db
    .select()
    .from(usersTable)
    .where(or(eq(usersTable.googleId, profile.id), eq(usersTable.email, profile.email)));

  if (existing) {
    // Link googleId if not yet linked
    if (!existing.googleId) {
      await db.update(usersTable).set({ googleId: profile.id }).where(eq(usersTable.id, existing.id));
    }

    if (!existing.profileComplete) {
      // Still needs to finish setup
      const tempToken = signTempToken({ userId: existing.id, email: existing.email });
      res.redirect(frontendUrl(`/complete-profile?token=${tempToken}`));
      return;
    }

    const token = signToken({ userId: existing.id, role: existing.role, email: existing.email });
    res.redirect(frontendUrl(`/?token=${token}`));
    return;
  }

  // New Google student — create with profileComplete = false
  const placeholderHash = await bcrypt.hash(`google-${profile.id}-${Date.now()}`, 10);
  const [newUser] = await db
    .insert(usersTable)
    .values({
      name:            profile.name,
      email:           profile.email,
      passwordHash:    placeholderHash,
      role:            "student",
      googleId:        profile.id,
      profileComplete: false,
    })
    .returning();

  const tempToken = signTempToken({ userId: newUser.id, email: newUser.email });
  res.redirect(frontendUrl(`/complete-profile?token=${tempToken}`));
});

// ─── Complete Google profile (name, phone, password) ─────────────────────────
const CompleteProfileBody = z.object({
  token:    z.string(),
  name:     z.string().min(2),
  phone:    z.string().optional(),
  password: z.string().min(6),
});

router.post("/auth/complete-profile", async (req, res): Promise<void> => {
  const parsed = CompleteProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request. Name and password (min 6 chars) are required." });
    return;
  }

  const { token, name, phone, password } = parsed.data;

  let payload: { userId: number; email: string } | null = null;
  try {
    payload = verifyTempToken(token);
  } catch {
    res.status(401).json({ error: "Invalid or expired setup link. Please sign in with Google again." });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, payload.userId));
  if (!user || user.profileComplete) {
    res.status(400).json({ error: "Profile already complete or user not found." });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await db
    .update(usersTable)
    .set({ name, phone: phone ?? null, passwordHash, profileComplete: true })
    .where(eq(usersTable.id, user.id));

  const finalToken = signToken({ userId: user.id, role: user.role, email: user.email });
  res.json({
    user: {
      id:        user.id,
      name,
      email:     user.email,
      role:      user.role,
      createdAt: user.createdAt.toISOString(),
    },
    token: finalToken,
  });
});

// ─── Unified login: email OR username, for students & admins ─────────────────
router.post("/auth/login", async (req, res): Promise<void> => {
  const { email: identifier, password } = req.body ?? {};

  if (typeof identifier !== "string" || typeof password !== "string" || !identifier || !password) {
    res.status(400).json({ error: "Email/username and password are required." });
    return;
  }

  // Look up by email first, then by username
  const [user] = await db
    .select()
    .from(usersTable)
    .where(or(eq(usersTable.email, identifier), eq(usersTable.username, identifier)));

  if (!user) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  if (!user.profileComplete) {
    res.status(403).json({ error: "Please complete your profile setup first." });
    return;
  }

  const token = signToken({ userId: user.id, role: user.role, email: user.email });
  res.json({
    user: {
      id:        user.id,
      name:      user.name,
      email:     user.email,
      role:      user.role,
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
      id:        user.id,
      name:      user.name,
      email:     user.email,
      role:      user.role,
      createdAt: user.createdAt.toISOString(),
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

  // Students must use the @learner.42.tech domain
  if (role === "student" && !email.endsWith(STUDENT_DOMAIN)) {
    res.status(400).json({ error: `Unauthorized Domain. Please use your 42 email.` });
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
    .values({ name, email, passwordHash, role: role ?? "student", phone: phone ?? null, profileComplete: true })
    .returning();

  const token = signToken({ userId: user.id, role: user.role, email: user.email });
  res.status(201).json({
    user: {
      id:        user.id,
      name:      user.name,
      email:     user.email,
      role:      user.role,
      createdAt: user.createdAt.toISOString(),
    },
    token,
  });
});

// ─── Dev: seed 6 mock student accounts ───────────────────────────────────────
router.get("/dev/seed-students", async (_req, res): Promise<void> => {
  const results: Array<{ username: string; status: string }> = [];

  for (let i = 1; i <= 6; i++) {
    const username = `s${i}`;
    const email    = `${username}@test.shuttle`;
    const name     = `Student ${i}`;

    try {
      const [existing] = await db
        .select()
        .from(usersTable)
        .where(or(eq(usersTable.username, username), eq(usersTable.email, email)));

      if (existing) {
        // Update password in case it changed
        const passwordHash = await bcrypt.hash(username, 10);
        await db
          .update(usersTable)
          .set({ passwordHash, username, profileComplete: true })
          .where(eq(usersTable.id, existing.id));
        results.push({ username, status: "updated" });
      } else {
        const passwordHash = await bcrypt.hash(username, 10);
        await db.insert(usersTable).values({
          name,
          email,
          passwordHash,
          role:            "student",
          username,
          profileComplete: true,
        });
        results.push({ username, status: "created" });
      }
    } catch (err) {
      results.push({ username, status: `error: ${String(err)}` });
    }
  }

  res.json({ success: true, results, hint: "Login with username s1–s6 and password s1–s6" });
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
        email:       internalEmail,
        passwordHash: placeholderPasswordHash,
        role:        "driver",
        phone,
        driverId,
      })
      .returning();

    res.status(201).json({
      success: true,
      driver: {
        id:       user.id,
        name:     user.name,
        driverId: user.driverId!,
        phone:    user.phone ?? undefined,
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
        id:        usersTable.id,
        name:      usersTable.name,
        email:     usersTable.email,
        phone:     usersTable.phone,
        driverId:  usersTable.driverId,
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

    await db.delete(usersTable).where(eq(usersTable.id, id));

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
      id:        account.id,
      name:      account.name,
      email:     account.email,
      role:      "student",
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
    id:        user.id,
    name:      user.name,
    email:     user.email,
    role:      user.role,
    createdAt: user.createdAt.toISOString(),
  });
});

export default router;
