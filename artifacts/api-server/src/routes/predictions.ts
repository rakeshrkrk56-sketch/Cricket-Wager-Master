import { Router, type IRouter } from "express";
import { db, usersTable, marketsTable, predictionsTable, transactionsTable } from "@workspace/db";
import { eq, and, desc, count } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
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

  const price = choice === "YES" ? Number(market.yesPrice) : Number(market.noPrice);
  const potentialWin = amount * price;

  // Deduct from wallet
  const newBalance = userBalance - amount;
  await db.update(usersTable).set({ walletBalance: String(newBalance) }).where(eq(usersTable.id, user.id));

  // Record transaction
  await db.insert(transactionsTable).values({
    userId: user.id,
    type: "loss",
    amount: String(amount),
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

  // Update market totals
  const newTotalYes = choice === "YES" ? market.totalYes + 1 : market.totalYes;
  const newTotalNo = choice === "NO" ? market.totalNo + 1 : market.totalNo;
  const newTotalAmount = Number(market.totalAmount) + amount;

  await db.update(marketsTable).set({
    totalYes: newTotalYes,
    totalNo: newTotalNo,
    totalAmount: String(newTotalAmount),
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
