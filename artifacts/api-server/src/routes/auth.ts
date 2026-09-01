import { Router, type IRouter, type Request, type Response } from "express";
import { db, otpChallengesTable, usersTable } from "@workspace/db";
import { and, count, desc, eq, gte, isNull, sql } from "drizzle-orm";
import { createHash, randomInt, scryptSync, timingSafeEqual } from "node:crypto";
import { createToken, requireAuth, recordLoginHistory } from "../middlewares/auth";
import { sendWhatsAppOtp } from "../lib/whatsappClient";
import {
  SendOtpBody,
  SendOtpResponse,
  VerifyOtpBody,
  VerifyOtpResponse,
  GetMeResponse,
  CreateGuestSessionBody,
  CreateGuestSessionResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.post("/auth/guest", async (req, res): Promise<void> => {
  const parsed = CreateGuestSessionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const fingerprint = createHash("sha256")
    .update(`${parsed.data.installationId}:${parsed.data.installationSecret}`)
    .digest("hex");
  const guestIdentity = `guest:${fingerprint}`;

  let [user] = await db.select().from(usersTable).where(eq(usersTable.phone, guestIdentity));
  if (!user) {
    const inserted = await db
      .insert(usersTable)
      .values({ phone: guestIdentity, name: "Guest Player" })
      .onConflictDoNothing({ target: usersTable.phone })
      .returning();
    user = inserted[0] ?? (await db.select().from(usersTable).where(eq(usersTable.phone, guestIdentity)))[0];
  }

  if (!user || user.status === "suspended") {
    res.status(403).json({ error: "Guest account unavailable", code: "ACCOUNT_SUSPENDED" });
    return;
  }

  const token = createToken(user.id, user.role);
  res.json(CreateGuestSessionResponse.parse({
    token,
    user: {
      id: user.id,
      phone: user.phone,
      name: user.name ?? "Guest Player",
      walletBalance: Number(user.walletBalance),
      kycStatus: user.kycStatus,
      status: user.status,
      role: user.role,
      createdAt: user.createdAt.toISOString(),
    },
  }));
});

// Normalize any phone input to canonical E.164-style form (+91XXXXXXXXXX for Indian numbers).
// This guarantees "9876543210", "+919876543210", "91 98765 43210", "098765 43210"
// all resolve to the SAME user account.
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (raw.trim().startsWith("+")) return `+${digits}`;
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 11 && digits.startsWith("0")) return `+91${digits.slice(1)}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  return `+${digits}`;
}

const OTP_EXPIRY_MINUTES = 10;
const OTP_RESEND_COOLDOWN_MS = 60_000;
const OTP_MAX_ATTEMPTS = 5;
const OTP_DAILY_LIMIT = 10;

// Fast2SMS expects a bare 10-digit Indian mobile number.
function toFast2smsMobile(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  if (digits.length === 10) return digits;
  return null;
}

function maskPhone(phone: string): string {
  return phone.length > 4 ? `${phone.slice(0, 3)}******${phone.slice(-2)}` : "***";
}

function configuredAdminCredentials(): { username: string; password: string } | null {
  const username = process.env.ADMIN_USERNAME?.trim();
  const password = process.env.ADMIN_PASSWORD;
  return username && password ? { username, password } : null;
}

function secureCredentialMatch(input: string, configured: string): boolean {
  const salt = process.env.SESSION_SECRET;
  if (!salt) throw new Error("SESSION_SECRET is required");
  const inputHash = scryptSync(input, salt, 32);
  const configuredHash = scryptSync(configured, salt, 32);
  return timingSafeEqual(inputHash, configuredHash);
}

function hashOtp(phone: string, otp: string): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is required");
  return createHash("sha256").update(`${phone}:${otp}:${secret}`).digest("hex");
}

router.post("/auth/admin-login", async (req, res): Promise<void> => {
  const body = req.body as { username?: unknown; password?: unknown };
  if (typeof body.username !== "string" || typeof body.password !== "string" || !body.username.trim() || !body.password) {
    res.status(400).json({ error: "Username and password are required" });
    return;
  }

  const credentials = configuredAdminCredentials();
  if (!credentials) {
    req.log.error("Admin username/password secrets are not configured");
    res.status(503).json({ error: "Admin login is not configured" });
    return;
  }

  let validCredentials = false;
  try {
    validCredentials =
      secureCredentialMatch(body.username.trim(), credentials.username)
      && secureCredentialMatch(body.password, credentials.password);
  } catch (error) {
    req.log.error({ err: error instanceof Error ? error.message : "unknown error" }, "Admin credential verification failed");
    res.status(503).json({ error: "Admin login is not configured" });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(and(eq(usersTable.role, "admin"), eq(usersTable.status, "active")))
    .limit(1);

  if (!validCredentials || !user) {
    res.status(401).json({ error: "Invalid username or password" });
    return;
  }

  const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ?? req.socket.remoteAddress ?? undefined;
  const deviceInfo = req.headers["user-agent"] ?? undefined;
  recordLoginHistory(user.id, ip, deviceInfo);

  res.json({
    token: createToken(user.id, user.role),
    user: {
      id: user.id,
      phone: user.phone,
      name: user.name ?? undefined,
      walletBalance: Number(user.walletBalance),
      kycStatus: user.kycStatus,
      status: user.status,
      role: user.role,
      createdAt: user.createdAt.toISOString(),
    },
  });
});

const sendOtpHandler = async (req: Request, res: Response): Promise<void> => {
  const parsed = SendOtpBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const phone = normalizePhone(parsed.data.phone);
  if (phone.length < 8) {
    res.status(400).json({ error: "Invalid phone number" });
    return;
  }
  const mobile = toFast2smsMobile(phone);
  if (!mobile) {
    res.status(400).json({ error: "Only Indian mobile numbers are supported" });
    return;
  }

  const cooldownStartedAt = new Date(Date.now() - OTP_RESEND_COOLDOWN_MS);
  const [recentChallenge] = await db
    .select({ id: otpChallengesTable.id })
    .from(otpChallengesTable)
    .where(and(eq(otpChallengesTable.phone, phone), gte(otpChallengesTable.createdAt, cooldownStartedAt)))
    .limit(1);
  if (recentChallenge) {
    res.status(429).json({ error: "Please wait before requesting another OTP" });
    return;
  }

  const dayStartedAt = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [{ total: dailyTotal }] = await db
    .select({ total: count() })
    .from(otpChallengesTable)
    .where(and(eq(otpChallengesTable.phone, phone), gte(otpChallengesTable.createdAt, dayStartedAt)));
  if (Number(dailyTotal) >= OTP_DAILY_LIMIT) {
    res.status(429).json({ error: "OTP request limit reached. Please try again later." });
    return;
  }

  const otp = randomInt(0, 10_000).toString().padStart(4, "0");
  const [challenge] = await db.insert(otpChallengesTable).values({
    phone,
    codeHash: hashOtp(phone, otp),
    expiresAt: new Date(Date.now() + OTP_EXPIRY_MINUTES * 60_000),
  }).returning({ id: otpChallengesTable.id });

  try {
    await sendWhatsAppOtp(mobile, otp);
    req.log.info({ phone: maskPhone(phone) }, "WhatsApp OTP sent");
    res.json(SendOtpResponse.parse({ success: true, message: "OTP sent successfully" }));
  } catch (error) {
    await db.delete(otpChallengesTable).where(eq(otpChallengesTable.id, challenge.id)).catch(() => undefined);
    req.log.error({ err: error instanceof Error ? error.message : "unknown error" }, "WhatsApp OTP request failed");
    res.status(502).json({ error: "Unable to send OTP right now" });
  }
};

const verifyOtpHandler = async (req: Request, res: Response): Promise<void> => {
  const parsed = VerifyOtpBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { otp } = parsed.data;
  const displayName = parsed.data.name?.trim() ?? "";
  const phone = normalizePhone(parsed.data.phone);
  const mobile = toFast2smsMobile(phone);
  if (!mobile) {
    res.status(400).json({ error: "Only Indian mobile numbers are supported" });
    return;
  }

  const [challenge] = await db
    .select()
    .from(otpChallengesTable)
    .where(and(eq(otpChallengesTable.phone, phone), isNull(otpChallengesTable.consumedAt)))
    .orderBy(desc(otpChallengesTable.createdAt))
    .limit(1);
  if (!challenge || challenge.expiresAt.getTime() <= Date.now()) {
    res.status(400).json({ error: "Invalid or expired OTP" });
    return;
  }
  if (challenge.attempts >= OTP_MAX_ATTEMPTS) {
    res.status(429).json({ error: "Too many verification attempts. Request a new OTP." });
    return;
  }

  const submittedHash = Buffer.from(hashOtp(phone, otp), "hex");
  const expectedHash = Buffer.from(challenge.codeHash, "hex");
  if (submittedHash.length !== expectedHash.length || !timingSafeEqual(submittedHash, expectedHash)) {
    await db.update(otpChallengesTable)
      .set({ attempts: sql`${otpChallengesTable.attempts} + 1` })
      .where(eq(otpChallengesTable.id, challenge.id));
    res.status(400).json({ error: "Invalid or expired OTP" });
    return;
  }

  // A phone number identifies the account. Look it up before consuming the
  // challenge so a new user can supply a name in a retry without requesting a
  // second OTP. Existing users never have their saved name overwritten by a
  // value from a later login.
  let [existingUser] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.phone, phone))
    .limit(1);
  if (!existingUser && !displayName) {
    res.status(400).json({
      error: "Choose a username to finish creating your account",
      code: "NAME_REQUIRED",
    });
    return;
  }

  const [consumed] = await db.update(otpChallengesTable)
    .set({ consumedAt: new Date() })
    .where(and(eq(otpChallengesTable.id, challenge.id), isNull(otpChallengesTable.consumedAt)))
    .returning({ id: otpChallengesTable.id });
  if (!consumed) {
    res.status(400).json({ error: "Invalid or expired OTP" });
    return;
  }

  // Get or create user — race-safe: if two logins hit at once, the unique
  // constraint on phone ensures only one row is created; the loser re-selects.
  let user = existingUser;
  if (!user) {
    const inserted = await db
      .insert(usersTable)
      .values({ phone, name: displayName })
      .onConflictDoNothing({ target: usersTable.phone })
      .returning();
    user = inserted[0] ?? (await db.select().from(usersTable).where(eq(usersTable.phone, phone)))[0];
  }

  // Block suspended users from logging in
  if (user.status === "suspended") {
    res.status(403).json({
      error: "Your account has been suspended. Please contact support.",
      code: "ACCOUNT_SUSPENDED",
    });
    return;
  }

  // Do not replace an existing user's profile name during phone login.
  // This prevents the same mobile number from appearing under a different
  // username on the next login.

  // Record login history (non-blocking)
  const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ?? req.socket.remoteAddress ?? undefined;
  const deviceInfo = req.headers["user-agent"] ?? undefined;
  recordLoginHistory(user.id, ip, deviceInfo);

  const token = createToken(user.id, user.role);
  res.json(
    VerifyOtpResponse.parse({
      token,
      user: {
        id: user.id,
        phone: user.phone,
        name: user.name ?? undefined,
        walletBalance: Number(user.walletBalance),
        kycStatus: user.kycStatus,
        status: user.status,
        role: user.role,
        createdAt: user.createdAt.toISOString(),
      },
    })
  );
};

router.post("/auth/send-otp", sendOtpHandler);
router.post("/send-otp", sendOtpHandler);
router.post("/auth/verify-otp", verifyOtpHandler);
router.post("/verify-otp", verifyOtpHandler);

router.get("/auth/me", requireAuth, async (req, res): Promise<void> => {
  const user = (req as any).user;
  res.json(
    GetMeResponse.parse({
      id: user.id,
      phone: user.phone,
      name: user.name ?? undefined,
      walletBalance: Number(user.walletBalance),
      kycStatus: user.kycStatus,
      status: user.status,
      role: user.role,
      createdAt: user.createdAt.toISOString(),
    })
  );
});

export default router;
