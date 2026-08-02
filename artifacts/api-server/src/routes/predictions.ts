import { Router, type IRouter } from "express";
import { db, usersTable, marketsTable, predictionsTable, transactionsTable } from "@workspace/db";
import { eq, and, desc, count } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { calculateOdds } from "../lib/odds";
import {
  PlacePredictionParams,
  PlacePredictionBody,
  PlacePredictionResponse,
  GetMyPredictionsQueryParams,
  GetMyPredictionsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.post("/markets/:marketId/predict", requireAuth, async (req, res): Promise<void> => {
  const pathParams = PlacePredictionParams.safeParse(req.params);
  if (!pathParams.success) {
    res.status(400).json({ error: pathParams.error.message });
    return;
  }

  const bodyParsed = PlacePredictionBody.safeParse(req.body);
  if (!bodyParsed.success) {
    res.status(400).json({ error: bodyParsed.error.message });
    return;
  }

  const { marketId } = pathParams.data;
  const { choice, amount } = bodyParsed.data;
  const user = (req as any).user;

  // Belt-and-suspenders: suspended users cannot predict
  // Hold users CAN still predict — only withdrawals are blocked for them
  if (user.status === "suspended") {
    res.status(403).json({ error: "Your account has been suspended. Contact support.", code: "ACCOUNT_SUSPENDED" });
    return;
  }

  // Minimum prediction ₹100
  if (amount < 100) {
    res.status(400).json({ error: "Minimum prediction amount is ₹100" });
    return;
  }

  const [market] = await db.select().from(marketsTable).where(eq(marketsTable.id, marketId));
  if (!market) {
    res.status(404).json({ error: "Market not found" });
    return;
  }
  if (market.status !== "open") {
    res.status(400).json({ error: "Market is not open for predictions" });
    return;
  }

  const userBalance = Number(user.walletBalance);
  if (userBalance < amount) {
    res.status(400).json({ error: "Insufficient wallet balance" });
    return;
  }

  // Use current odds for this prediction
  const price = choice === "YES" ? Number(market.yesPrice) : Number(market.noPrice);
  const potentialWin = Math.round(amount * price * 100) / 100;

  // Deduct from wallet
  const balanceBefore = userBalance;
  const newBalance = userBalance - amount;
  await db.update(usersTable).set({ walletBalance: String(newBalance) }).where(eq(usersTable.id, user.id));

  // Record transaction with balanceBefore
  await db.insert(transactionsTable).values({
    userId: user.id,
    type: "loss",
    amount: String(amount),
    balanceBefore: String(balanceBefore),
    balanceAfter: String(newBalance),
    referenceId: marketId,
    note: `Prediction on: ${market.question}`,
  });

  // Create prediction
  const [prediction] = await db.insert(predictionsTable).values({
    userId: user.id,
    marketId,
    matchId: market.matchId,
    question: market.question,
    choice: choice as "YES" | "NO",
    amount: String(amount),
    potentialWin: String(potentialWin),
    status: "pending",
  }).returning();

  // Update market pool totals
  const newYesPool = choice === "YES"
    ? Number(market.yesPool) + amount
    : Number(market.yesPool);
  const newNoPool = choice === "NO"
    ? Number(market.noPool) + amount
    : Number(market.noPool);
  const newTotalYes = choice === "YES" ? market.totalYes + 1 : market.totalYes;
  const newTotalNo = choice === "NO" ? market.totalNo + 1 : market.totalNo;
  const newTotalAmount = Number(market.totalAmount) + amount;

  // Recalculate dynamic odds after this bet
  const { yesOdds, noOdds } = calculateOdds(newYesPool, newNoPool);

  await db.update(marketsTable).set({
    totalYes: newTotalYes,
    totalNo: newTotalNo,
    totalAmount: String(newTotalAmount),
    yesPool: String(newYesPool),
    noPool: String(newNoPool),
    yesPrice: String(yesOdds),
    noPrice: String(noOdds),
    updatedAt: new Date(),
  }).where(eq(marketsTable.id, marketId));

  res.json(
    PlacePredictionResponse.parse({
      id: prediction.id,
      userId: prediction.userId,
      marketId: prediction.marketId,
      matchId: prediction.matchId,
      question: prediction.question,
      choice: prediction.choice,
      amount: Number(prediction.amount),
      potentialWin: Number(prediction.potentialWin),
      status: prediction.status,
      createdAt: prediction.createdAt.toISOString(),
    })
  );
});

router.get("/predictions/my", requireAuth, async (req, res): Promise<void> => {
  const params = GetMyPredictionsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const user = (req as any).user;
  const { page = 1, limit = 20, status } = params.data;
  const offset = (page - 1) * limit;

  const conditions = [eq(predictionsTable.userId, user.id)];
  if (status) conditions.push(eq(predictionsTable.status, status as any));

  const preds = await db
    .select()
    .from(predictionsTable)
    .where(and(...conditions))
    .orderBy(desc(predictionsTable.createdAt))
    .limit(limit)
    .offset(offset);

  const [{ total }] = await db
    .select({ total: count() })
    .from(predictionsTable)
    .where(and(...conditions));

  res.json(
    GetMyPredictionsResponse.parse({
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
      total: Number(total),
      page,
      limit,
    })
  );
});

export default router;
