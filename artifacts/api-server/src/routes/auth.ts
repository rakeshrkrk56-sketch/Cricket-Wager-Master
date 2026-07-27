import { Router, type IRouter } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { createToken, requireAuth } from "../middlewares/auth";
import {
  SendOtpBody,
  SendOtpResponse,
  VerifyOtpBody,
  VerifyOtpResponse,
  GetMeResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

// Mock OTP store: phone -> otp
const otpStore = new Map<string, string>();

router.post("/auth/send-otp", async (req, res): Promise<void> => {
  const parsed = SendOtpBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { phone } = parsed.data;
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
  const { phone, otp } = parsed.data;
  const expectedOtp = otpStore.get(phone);

  // Mock: accept 1234 always or if OTP matches
  if (otp !== "1234" && otp !== expectedOtp) {
    res.status(400).json({ error: "Invalid OTP" });
    return;
  }
  otpStore.delete(phone);

  // Get or create user
  let [user] = await db.select().from(usersTable).where(eq(usersTable.phone, phone));
  if (!user) {
    const [newUser] = await db.insert(usersTable).values({ phone }).returning();
    user = newUser;
  }

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
