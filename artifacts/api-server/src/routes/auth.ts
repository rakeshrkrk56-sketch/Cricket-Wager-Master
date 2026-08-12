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

const MSG91_OTP_URL = "https://control.msg91.com/api/v5/otp";
const MSG91_AUTHKEY = process.env.MSG91_AUTHKEY;
const MSG91_TEMPLATE_ID = process.env.MSG91_TEMPLATE_ID;
const otpSentAt = new Map<string, number>();
const OTP_RESEND_COOLDOWN_MS = 60_000;

function maskPhone(phone: string): string {
  return phone.length > 4 ? `${phone.slice(0, 3)}******${phone.slice(-2)}` : "***";
}

async function readProviderResponse(response: Response): Promise<Record<string, unknown>> {
  try {
    const body: unknown = await response.json();
    return body && typeof body === "object" ? body as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function providerSucceeded(response: Response, body: Record<string, unknown>): boolean {
  const type = String(body.type ?? body.status ?? "").toLowerCase();
  return response.ok && (!type || type === "success" || type === "ok");
}

function msg91Configured(): boolean {
  return Boolean(MSG91_AUTHKEY && MSG91_TEMPLATE_ID);
}

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
  if (!msg91Configured()) {
    req.log.error(
      { hasAuthkey: Boolean(MSG91_AUTHKEY), hasTemplateId: Boolean(MSG91_TEMPLATE_ID) },
      "MSG91 OTP service is not configured",
    );
    res.status(503).json({ error: "OTP service is not configured" });
    return;
  }

  const lastSentAt = otpSentAt.get(phone);
  if (lastSentAt && Date.now() - lastSentAt < OTP_RESEND_COOLDOWN_MS) {
    res.status(429).json({ error: "Please wait before requesting another OTP" });
    return;
  }

  const url = new URL(MSG91_OTP_URL);
  url.searchParams.set("template_id", MSG91_TEMPLATE_ID!);
  url.searchParams.set("mobile", phone.slice(1));
  url.searchParams.set("authkey", MSG91_AUTHKEY!);

  try {
    const providerResponse = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    const providerBody = await readProviderResponse(providerResponse);
    if (!providerSucceeded(providerResponse, providerBody)) {
      req.log.error(
        {
          status: providerResponse.status,
          providerType: providerBody.type ?? providerBody.status,
          providerMessage: providerBody.message ?? providerBody.msg ?? providerBody.error,
        },
        "MSG91 rejected OTP request",
      );
      res.status(502).json({ error: "Unable to send OTP right now" });
      return;
    }
    req.log.info(
      { providerType: providerBody.type ?? providerBody.status, requestId: providerBody.request_id },
      "MSG91 accepted OTP request",
    );

    otpSentAt.set(phone, Date.now());
    req.log.info({ phone: maskPhone(phone) }, "OTP sent");
    res.json(SendOtpResponse.parse({ success: true, message: "OTP sent successfully" }));
  } catch (error) {
    req.log.error({ err: error instanceof Error ? error.message : "unknown error" }, "MSG91 OTP request failed");
    res.status(502).json({ error: "Unable to send OTP right now" });
  }
});

router.post("/auth/verify-otp", async (req, res): Promise<void> => {
  const parsed = VerifyOtpBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { otp } = parsed.data;
  const phone = normalizePhone(parsed.data.phone);
  if (!msg91Configured()) {
    req.log.error(
      { hasAuthkey: Boolean(MSG91_AUTHKEY), hasTemplateId: Boolean(MSG91_TEMPLATE_ID) },
      "MSG91 OTP service is not configured",
    );
    res.status(503).json({ error: "OTP service is not configured" });
    return;
  }

  const url = new URL(`${MSG91_OTP_URL}/verify`);
  url.searchParams.set("otp", otp);
  url.searchParams.set("mobile", phone.slice(1));

  try {
    const providerResponse = await fetch(url, {
      method: "GET",
      headers: { authkey: MSG91_AUTHKEY! },
    });
    const providerBody = await readProviderResponse(providerResponse);
    if (!providerSucceeded(providerResponse, providerBody)) {
      if (providerResponse.status === 401) {
        req.log.error("MSG91 rejected the configured authkey");
        res.status(502).json({ error: "OTP service configuration is invalid" });
        return;
      }
      res.status(400).json({ error: "Invalid or expired OTP" });
      return;
    }
    otpSentAt.delete(phone);
  } catch (error) {
    req.log.error({ err: error instanceof Error ? error.message : "unknown error" }, "MSG91 OTP verification failed");
    res.status(502).json({ error: "Unable to verify OTP right now" });
    return;
  }

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
