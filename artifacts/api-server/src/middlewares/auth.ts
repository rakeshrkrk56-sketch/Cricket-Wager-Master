import { Request, Response, NextFunction } from "express";
import { db, usersTable, loginHistoryTable } from "@workspace/db";
import { eq, and, gte } from "drizzle-orm";

// Simple JWT-like token: base64(userId:role:timestamp)
export function createToken(userId: string, role: string): string {
  const payload = `${userId}:${role}:${Date.now()}`;
  return Buffer.from(payload).toString("base64url");
}

export function parseToken(token: string): { userId: string; role: string } | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf-8");
    const parts = decoded.split(":");
    if (parts.length < 2) return null;
    return { userId: parts[0], role: parts[1] };
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
