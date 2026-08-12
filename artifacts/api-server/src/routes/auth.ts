import { Router, type IRouter } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { createToken, requireAuth, recordLoginHistory } from "../middlewares/auth";
import {
  SendOtpBody,
  SendOtpResponse,
  VerifyOtpBody,
  VerifyOtpResponse,
  GetMeResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

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

// Mock OTP store: phone -> otp
const otpStore = new Map<string, string>();

router.post("/auth/send-otp", async (req, res): Promise<void> => {
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
  // Mock: always use 1234 as OTP
  const otp = "1234";
  otpStore.set(phone, otp);
  req.log.info({ phone }, "OTP sent (mock)");
  res.json(SendOtpResponse.parse({ success: true, message: "OTP sent successfully (mock: 1234)" }));
});

router.post("/auth/verify-otp", async (req, res): Promise<void> => {
  const parsed = VerifyOtpBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { otp } = parsed.data;
  const phone = normalizePhone(parsed.data.phone);
  const expectedOtp = otpStore.get(phone);

  // Mock: accept 1234 always or if OTP matches
  if (otp !== "1234" && otp !== expectedOtp) {
    res.status(400).json({ error: "Invalid OTP" });
    return;
  }
  otpStore.delete(phone);

  // Get or create user — race-safe: if two logins hit at once, the unique
  // constraint on phone ensures only one row is created; the loser re-selects.
  let [user] = await db.select().from(usersTable).where(eq(usersTable.phone, phone));
  if (!user) {
    const inserted = await db
      .insert(usersTable)
      .values({ phone })
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
});

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
