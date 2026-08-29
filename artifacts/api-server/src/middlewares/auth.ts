import { Request, Response, NextFunction } from "express";
import { db, usersTable, loginHistoryTable } from "@workspace/db";
import { eq, and, gte } from "drizzle-orm";
import { createHmac, timingSafeEqual } from "node:crypto";

const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function sessionSecret(): string {
  const secret = process.env["SESSION_SECRET"];
  if (!secret) throw new Error("SESSION_SECRET is required");
  return secret;
}

function sign(payload: string): string {
  return createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
}

export function createToken(userId: string, role: string): string {
  const issuedAt = Date.now();
  const payload = Buffer.from(JSON.stringify({
    version: 1,
    userId,
    role,
    issuedAt,
    expiresAt: issuedAt + TOKEN_TTL_MS,
  })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function parseToken(token: string): { userId: string; role: string } | null {
  try {
    const [payload, signature, extra] = token.split(".");
    if (!payload || !signature || extra !== undefined) return null;
    const expected = sign(payload);
    const actualBytes = Buffer.from(signature, "base64url");
    const expectedBytes = Buffer.from(expected, "base64url");
    if (
      actualBytes.length !== expectedBytes.length
      || !timingSafeEqual(actualBytes, expectedBytes)
    ) return null;

    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf-8")) as {
      version?: number;
      userId?: string;
      role?: string;
      issuedAt?: number;
      expiresAt?: number;
    };
    const now = Date.now();
    if (
      decoded.version !== 1
      || typeof decoded.userId !== "string"
      || typeof decoded.role !== "string"
      || typeof decoded.issuedAt !== "number"
      || typeof decoded.expiresAt !== "number"
      || decoded.issuedAt > now + 60_000
      || decoded.expiresAt <= now
    ) return null;
    return { userId: decoded.userId, role: decoded.role };
  } catch {
    return null;
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const token = authHeader.slice(7);
  const parsed = parseToken(token);
  if (!parsed) {
    res.status(401).json({ error: "Invalid token" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, parsed.userId));
  if (!user || user.status === "suspended") {
    res.status(401).json({ error: "User not found or suspended", code: "ACCOUNT_SUSPENDED" });
    return;
  }
  (req as any).user = user;
  next();
}

// Middleware to block hold accounts from specific routes (withdrawals)
export async function requireNotHold(req: Request, res: Response, next: NextFunction): Promise<void> {
  const user = (req as any).user;
  if (user?.status === "hold") {
    res.status(403).json({
      error: "Your withdrawal access has been temporarily disabled while your account is under review. Please contact support.",
      code: "ACCOUNT_HOLD",
    });
    return;
  }
  next();
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  await requireAuth(req, res, async () => {
    const user = (req as any).user;
    if (user?.role !== "admin") {
      res.status(403).json({ error: "Admin access required" });
      return;
    }
    next();
  });
}

// Record login history — deduplicated per user per 5 minutes to avoid spam
export async function recordLoginHistory(userId: string, ip?: string, deviceInfo?: string): Promise<void> {
  try {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const recent = await db
      .select({ id: loginHistoryTable.id })
      .from(loginHistoryTable)
      .where(and(eq(loginHistoryTable.userId, userId), gte(loginHistoryTable.createdAt, fiveMinutesAgo)))
      .limit(1);
    if (recent.length === 0) {
      await db.insert(loginHistoryTable).values({ userId, ip: ip ?? null, deviceInfo: deviceInfo ?? null });
    }
  } catch {
    // Non-critical — don't fail the request
  }
}
