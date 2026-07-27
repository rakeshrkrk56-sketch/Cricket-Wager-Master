import { Router, type IRouter } from "express";
import { db, usersTable, matchesTable, marketsTable, predictionsTable, transactionsTable } from "@workspace/db";
import { eq, and, desc, count, sql, like, gte } from "drizzle-orm";
import { requireAdmin } from "../middlewares/auth";
import {
  ListUsersQueryParams,
  ListUsersResponse,
  GetUserParams,
  GetUserResponse,
  UpdateUserParams,
  UpdateUserBody,
  UpdateUserResponse,
  AdminListMatchesQueryParams,
  AdminListMatchesResponse,
  CreateMatchBody,
  CreateMatchResponse,
  UpdateMatchParams,
  UpdateMatchBody,
  UpdateMatchResponse,
  CreateMarketParams,
  CreateMarketBody,
  CreateMarketResponse,
  UpdateMarketParams,
  UpdateMarketBody,
  UpdateMarketResponse,
  SettleMarketParams,
  SettleMarketBody,
  SettleMarketResponse,
  RefundMarketParams,
  RefundMarketResponse,
  GetMarketPredictionsParams,
  GetMarketPredictionsResponse,
  GetAdminStatsResponse,
} from "@workspace/api-zod";
import { serializeMatch, serializeMarket } from "./matches";

const router: IRouter = Router();

// ─── Users ────────────────────────────────────────────────────────────────────

router.get("/admin/users", requireAdmin, async (req, res): Promise<void> => {
  const params = ListUsersQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const { page = 1, limit = 20, search, status } = params.data;
  const offset = (page - 1) * limit;

  const conditions: any[] = [];
  if (status) conditions.push(eq(usersTable.status, status as any));
  if (search) conditions.push(like(usersTable.phone, `%${search}%`));

  const users = await db
    .select()
    .from(usersTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(usersTable.createdAt))
    .limit(limit)
    .offset(offset);

  const [{ total }] = await db
    .select({ total: count() })
    .from(usersTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  res.json(
    ListUsersResponse.parse({
      users: users.map(serializeUser),
      total: Number(total),
      page,
      limit,
    })
  );
});

router.get("/admin/users/:userId", requireAdmin, async (req, res): Promise<void> => {
  const params = GetUserParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, params.data.userId));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const preds = await db.select().from(predictionsTable).where(eq(predictionsTable.userId, user.id));
  const won = preds.filter((p) => p.status === "won").length;
  const lost = preds.filter((p) => p.status === "lost").length;
  const totalAmountBet = preds.reduce((s, p) => s + Number(p.amount), 0);
  const totalAmountWon = preds.filter((p) => p.status === "won").reduce((s, p) => s + Number(p.potentialWin), 0);

  res.json(
    GetUserResponse.parse({
      ...serializeUser(user),
      totalPredictions: preds.length,
      totalWon: won,
      totalLost: lost,
      totalAmountBet,
      totalAmountWon,
    })
  );
});

router.patch("/admin/users/:userId", requireAdmin, async (req, res): Promise<void> => {
  const params = UpdateUserParams.safeParse(req.params);
  const body = UpdateUserBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const updates: any = { updatedAt: new Date() };
  if (body.data.status) updates.status = body.data.status;
  if (body.data.kycStatus) updates.kycStatus = body.data.kycStatus;
  if (body.data.name !== undefined) updates.name = body.data.name;

  const [user] = await db
    .update(usersTable)
    .set(updates)
    .where(eq(usersTable.id, params.data.userId))
    .returning();

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(UpdateUserResponse.parse(serializeUser(user)));
});

// ─── Matches ──────────────────────────────────────────────────────────────────

router.get("/admin/matches", requireAdmin, async (req, res): Promise<void> => {
  const params = AdminListMatchesQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const conditions: any[] = [];
  if (params.data.status) conditions.push(eq(matchesTable.status, params.data.status as any));

  const matches = await db
    .select()
    .from(matchesTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(matchesTable.startTime));

  res.json(
    AdminListMatchesResponse.parse({
      matches: matches.map(serializeMatch),
      total: matches.length,
    })
  );
});

router.post("/admin/matches", requireAdmin, async (req, res): Promise<void> => {
  const parsed = CreateMatchBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { team1, team2, tournament, startTime, cricApiMatchId } = parsed.data;
  const [match] = await db
    .insert(matchesTable)
    .values({
      team1,
      team2,
      tournament,
      startTime: startTime instanceof Date ? startTime : new Date(startTime as any),
      cricApiMatchId: cricApiMatchId ?? null,
      title: `${team1} vs ${team2}`,
    })
    .returning();

  res.status(201).json(CreateMatchResponse.parse(serializeMatch(match)));
});

router.patch("/admin/matches/:matchId", requireAdmin, async (req, res): Promise<void> => {
  const params = UpdateMatchParams.safeParse(req.params);
  const body = UpdateMatchBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const updates: any = { updatedAt: new Date() };
  if (body.data.status) updates.status = body.data.status;
  if (body.data.title) updates.title = body.data.title;

  const [match] = await db
    .update(matchesTable)
    .set(updates)
    .where(eq(matchesTable.id, params.data.matchId))
    .returning();

  if (!match) {
    res.status(404).json({ error: "Match not found" });
    return;
  }
  res.json(UpdateMatchResponse.parse(serializeMatch(match)));
});

// ─── Markets ──────────────────────────────────────────────────────────────────

router.post("/admin/matches/:matchId/markets", requireAdmin, async (req, res): Promise<void> => {
  const pathParams = CreateMarketParams.safeParse(req.params);
  const body = CreateMarketBody.safeParse(req.body);
  if (!pathParams.success) {
    res.status(400).json({ error: pathParams.error.message });
    return;
  }
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [match] = await db.select().from(matchesTable).where(eq(matchesTable.id, pathParams.data.matchId));
  if (!match) {
    res.status(404).json({ error: "Match not found" });
    return;
  }

  const [market] = await db
    .insert(marketsTable)
    .values({
      matchId: pathParams.data.matchId,
      question: body.data.question,
      questionHindi: body.data.questionHindi ?? null,
      category: body.data.category as any,
      yesPrice: String(body.data.yesPrice ?? 2.0),
      noPrice: String(body.data.noPrice ?? 2.0),
    })
    .returning();

  res.status(201).json(CreateMarketResponse.parse(serializeMarket(market)));
});

router.patch("/admin/markets/:marketId", requireAdmin, async (req, res): Promise<void> => {
  const params = UpdateMarketParams.safeParse(req.params);
  const body = UpdateMarketBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const updates: any = { updatedAt: new Date() };
  if (body.data.status) updates.status = body.data.status;
  if (body.data.yesPrice !== undefined) updates.yesPrice = String(body.data.yesPrice);
  if (body.data.noPrice !== undefined) updates.noPrice = String(body.data.noPrice);

  const [market] = await db
    .update(marketsTable)
    .set(updates)
    .where(eq(marketsTable.id, params.data.marketId))
    .returning();

  if (!market) {
    res.status(404).json({ error: "Market not found" });
    return;
  }
  res.json(UpdateMarketResponse.parse(serializeMarket(market)));
});

router.post("/admin/markets/:marketId/settle", requireAdmin, async (req, res): Promise<void> => {
  const params = SettleMarketParams.safeParse(req.params);
  const body = SettleMarketBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const { marketId } = params.data;
  const { correctAnswer } = body.data;

  const [market] = await db.select().from(marketsTable).where(eq(marketsTable.id, marketId));
  if (!market) {
    res.status(404).json({ error: "Market not found" });
    return;
  }
  if (market.status === "settled") {
    res.status(400).json({ error: "Market already settled" });
    return;
  }

  // Get all pending predictions
  const preds = await db
    .select()
    .from(predictionsTable)
    .where(and(eq(predictionsTable.marketId, marketId), eq(predictionsTable.status, "pending")));

  const winners = preds.filter((p) => p.choice === correctAnswer);
  const losers = preds.filter((p) => p.choice !== correctAnswer);
  let totalPayout = 0;

  // Credit winners
  for (const pred of winners) {
    const win = Number(pred.potentialWin);
    totalPayout += win;
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, pred.userId));
    if (user) {
      const newBalance = Number(user.walletBalance) + win;
      await db.update(usersTable).set({ walletBalance: String(newBalance) }).where(eq(usersTable.id, user.id));
      await db.insert(transactionsTable).values({
        userId: user.id,
        type: "win",
        amount: String(win),
        balanceAfter: String(newBalance),
        referenceId: marketId,
        note: `Win: ${market.question}`,
      });
    }
    await db.update(predictionsTable).set({ status: "won" }).where(eq(predictionsTable.id, pred.id));
  }

  // Mark losers
  for (const pred of losers) {
    await db.update(predictionsTable).set({ status: "lost" }).where(eq(predictionsTable.id, pred.id));
  }

  // Settle market
  await db.update(marketsTable).set({
    status: "settled",
    correctAnswer: correctAnswer as any,
    settledAt: new Date(),
  }).where(eq(marketsTable.id, marketId));

  res.json(
    SettleMarketResponse.parse({
      marketId,
      totalPredictions: preds.length,
      winnersCount: winners.length,
      totalPayout,
      status: "settled",
    })
  );
});

router.post("/admin/markets/:marketId/refund", requireAdmin, async (req, res): Promise<void> => {
  const params = RefundMarketParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const { marketId } = params.data;
  const [market] = await db.select().from(marketsTable).where(eq(marketsTable.id, marketId));
  if (!market) {
    res.status(404).json({ error: "Market not found" });
    return;
  }

  const preds = await db
    .select()
    .from(predictionsTable)
    .where(and(eq(predictionsTable.marketId, marketId), eq(predictionsTable.status, "pending")));

  let totalPayout = 0;
  for (const pred of preds) {
    const refundAmt = Number(pred.amount);
    totalPayout += refundAmt;
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, pred.userId));
    if (user) {
      const newBalance = Number(user.walletBalance) + refundAmt;
      await db.update(usersTable).set({ walletBalance: String(newBalance) }).where(eq(usersTable.id, user.id));
      await db.insert(transactionsTable).values({
        userId: user.id,
        type: "refund",
        amount: String(refundAmt),
        balanceAfter: String(newBalance),
        referenceId: marketId,
        note: `Refund: ${market.question}`,
      });
    }
    await db.update(predictionsTable).set({ status: "refunded" }).where(eq(predictionsTable.id, pred.id));
  }

  await db.update(marketsTable).set({ status: "refunded" }).where(eq(marketsTable.id, marketId));

  res.json(
    RefundMarketResponse.parse({
      marketId,
      totalPredictions: preds.length,
      winnersCount: 0,
      totalPayout,
      status: "refunded",
    })
  );
});

router.get("/admin/markets/:marketId/predictions", requireAdmin, async (req, res): Promise<void> => {
  const params = GetMarketPredictionsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const preds = await db
    .select()
    .from(predictionsTable)
    .where(eq(predictionsTable.marketId, params.data.marketId))
    .orderBy(desc(predictionsTable.createdAt));

  res.json(
    GetMarketPredictionsResponse.parse({
      predictions: preds.map((p) => ({
        id: p.id,
        userId: p.userId,
        marketId: p.marketId,
        matchId: p.matchId,
        question: p.question,
        choice: p.choice,
        amount: Number(p.amount),
        potentialWin: Number(p.potentialWin),
        status: p.status,
        createdAt: p.createdAt.toISOString(),
      })),
      total: preds.length,
      page: 1,
      limit: 1000,
    })
  );
});

// ─── Stats ────────────────────────────────────────────────────────────────────

router.get("/admin/stats", requireAdmin, async (req, res): Promise<void> => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [[{ totalUsers }], [{ activeUsers }]] = await Promise.all([
    db.select({ totalUsers: count() }).from(usersTable),
    db.select({ activeUsers: count() }).from(usersTable).where(eq(usersTable.status, "active")),
  ]);
  const [[{ totalMatches }], [{ liveMatches }]] = await Promise.all([
    db.select({ totalMatches: count() }).from(matchesTable),
    db.select({ liveMatches: count() }).from(matchesTable).where(eq(matchesTable.status, "live")),
  ]);
  const [[{ totalPredictions }], [{ pendingPredictions }]] = await Promise.all([
    db.select({ totalPredictions: count() }).from(predictionsTable),
    db.select({ pendingPredictions: count() }).from(predictionsTable).where(eq(predictionsTable.status, "pending")),
  ]);

  const allPreds = await db.select().from(predictionsTable);
  const totalVolume = allPreds.reduce((s, p) => s + Number(p.amount), 0);
  const totalPayout = allPreds.filter((p) => p.status === "won").reduce((s, p) => s + Number(p.potentialWin), 0);
  const platformRevenue = totalVolume - totalPayout;

  const todayTxs = await db
    .select()
    .from(transactionsTable)
    .where(gte(transactionsTable.createdAt, today));

  const todayDeposits = todayTxs.filter((t) => t.type === "deposit").reduce((s, t) => s + Number(t.amount), 0);
  const todayWithdrawals = todayTxs.filter((t) => t.type === "withdraw").reduce((s, t) => s + Number(t.amount), 0);

  res.json(
    GetAdminStatsResponse.parse({
      totalUsers: Number(totalUsers),
      activeUsers: Number(activeUsers),
      totalMatches: Number(totalMatches),
      liveMatches: Number(liveMatches),
      totalPredictions: Number(totalPredictions),
      pendingPredictions: Number(pendingPredictions),
      totalVolume,
      totalPayout,
      platformRevenue,
      todayDeposits,
      todayWithdrawals,
    })
  );
});

function serializeUser(u: any) {
  return {
    id: u.id,
    phone: u.phone,
    name: u.name ?? undefined,
    walletBalance: Number(u.walletBalance),
    kycStatus: u.kycStatus,
    status: u.status,
    role: u.role,
    createdAt: u.createdAt instanceof Date ? u.createdAt.toISOString() : u.createdAt,
  };
}

export default router;
