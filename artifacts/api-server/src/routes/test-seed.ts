/**
 * Test-only seeding endpoints — only registered when NODE_ENV !== "production".
 *
 * SECURITY: every request must carry the X-E2E-Secret header matching the
 * E2E_TEST_SECRET environment variable. Without the secret this surface is
 * unreachable even in staging, preventing unauthenticated privilege escalation.
 */
import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db, usersTable, marketsTable, matchesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { createToken } from "../middlewares/auth";

const router: IRouter = Router();

/** Middleware: verify X-E2E-Secret header */
function requireTestSecret(req: Request, res: Response, next: NextFunction): void {
  const secret = process.env["E2E_TEST_SECRET"];
  if (!secret) {
    res.status(503).json({ error: "E2E_TEST_SECRET not configured on this server" });
    return;
  }
  const provided = req.headers["x-e2e-secret"];
  if (!provided || provided !== secret) {
    res.status(403).json({ error: "Forbidden: invalid test secret" });
    return;
  }
  next();
}

router.use("/test", requireTestSecret);

/**
 * POST /api/test/seed-user
 * Creates (or resets) a test user and returns their auth token.
 * Body: { phone, role?, walletBalance? }
 */
router.post("/test/seed-user", async (req, res): Promise<void> => {
  const { phone, role = "user", walletBalance = "0" } = req.body as {
    phone: string;
    role?: string;
    walletBalance?: string;
  };

  if (!phone) {
    res.status(400).json({ error: "phone is required" });
    return;
  }

  const [existing] = await db.select().from(usersTable).where(eq(usersTable.phone, phone));

  let user;
  if (existing) {
    [user] = await db
      .update(usersTable)
      .set({ role: role as "user" | "admin", walletBalance: String(walletBalance), updatedAt: new Date() })
      .where(eq(usersTable.phone, phone))
      .returning();
  } else {
    [user] = await db
      .insert(usersTable)
      .values({ phone, role: role as "user" | "admin", walletBalance: String(walletBalance) })
      .returning();
  }

  const token = createToken(user.id, user.role);
  res.json({ token, user: { id: user.id, phone: user.phone, role: user.role, walletBalance: Number(user.walletBalance) } });
});

/**
 * POST /api/test/seed-match-market
 * Creates a live match + open market for prediction tests.
 * Seeds both pools to 1000 so dynamic odds are active from the first bet.
 */
router.post("/test/seed-match-market", async (req, res): Promise<void> => {
  const [match] = await db
    .insert(matchesTable)
    .values({
      team1: "Team A",
      team2: "Team B",
      tournament: "Test Cup",
      status: "live",
      startTime: new Date(),
    })
    .returning();

  // Seed both pools so calculateOdds returns dynamic (not default) values.
  const [market] = await db
    .insert(marketsTable)
    .values({
      matchId: match.id,
      question: "Will Team A win the toss?",
      category: "toss",
      status: "open",
      yesPool: "1000",
      noPool: "1000",
      yesPrice: "1.85",
      noPrice: "1.85",
    })
    .returning();

  res.json({
    matchId: match.id,
    marketId: market.id,
    yesPrice: Number(market.yesPrice),
    noPrice: Number(market.noPrice),
  });
});

/**
 * POST /api/test/cleanup
 * Deletes test users by ID to keep the DB clean between test runs.
 */
router.post("/test/cleanup", async (req, res): Promise<void> => {
  const { userIds } = req.body as { userIds?: string[] };
  if (userIds?.length) {
    for (const id of userIds) {
      await db.delete(usersTable).where(eq(usersTable.id, id));
    }
  }
  res.json({ success: true });
});

export default router;
