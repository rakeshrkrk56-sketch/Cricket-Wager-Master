import { Router, type IRouter } from "express";
import { db, usersTable, transactionsTable } from "@workspace/db";
import { eq, desc, count, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import {
  DepositWalletBody,
  WithdrawWalletBody,
  GetWalletResponse,
  DepositWalletResponse,
  WithdrawWalletResponse,
  GetTransactionsQueryParams,
  GetTransactionsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

function walletResponse(user: any) {
  return {
    userId: user.id,
    balance: Number(user.walletBalance),
    depositTotal: 0,
    withdrawTotal: 0,
    winTotal: 0,
    bonusTotal: 0,
  };
}

router.get("/wallet", requireAuth, async (req, res): Promise<void> => {
  const user = (req as any).user;

  // Compute totals from transactions
  const txs = await db
    .select()
    .from(transactionsTable)
    .where(eq(transactionsTable.userId, user.id));

  let depositTotal = 0, withdrawTotal = 0, winTotal = 0, bonusTotal = 0;
  for (const tx of txs) {
    const amt = Number(tx.amount);
    if (tx.type === "deposit") depositTotal += amt;
    else if (tx.type === "withdraw") withdrawTotal += amt;
    else if (tx.type === "win") winTotal += amt;
    else if (tx.type === "bonus") bonusTotal += amt;
  }

  res.json(
    GetWalletResponse.parse({
      userId: user.id,
      balance: Number(user.walletBalance),
      depositTotal,
      withdrawTotal,
      winTotal,
      bonusTotal,
    })
  );
});

router.post("/wallet/deposit", requireAuth, async (req, res): Promise<void> => {
  const parsed = DepositWalletBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const user = (req as any).user;
  const amount = parsed.data.amount;
  const newBalance = Number(user.walletBalance) + amount;

  await db.update(usersTable).set({ walletBalance: String(newBalance) }).where(eq(usersTable.id, user.id));
  await db.insert(transactionsTable).values({
    userId: user.id,
    type: "deposit",
    amount: String(amount),
    balanceAfter: String(newBalance),
    note: parsed.data.note,
  });

  res.json(
    DepositWalletResponse.parse({
      userId: user.id,
      balance: newBalance,
      depositTotal: 0,
      withdrawTotal: 0,
      winTotal: 0,
      bonusTotal: 0,
    })
  );
});

router.post("/wallet/withdraw", requireAuth, async (req, res): Promise<void> => {
  const parsed = WithdrawWalletBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const user = (req as any).user;
  const amount = parsed.data.amount;
  const currentBalance = Number(user.walletBalance);

  if (currentBalance < amount) {
    res.status(400).json({ error: "Insufficient balance" });
    return;
  }
  const newBalance = currentBalance - amount;

  await db.update(usersTable).set({ walletBalance: String(newBalance) }).where(eq(usersTable.id, user.id));
  await db.insert(transactionsTable).values({
    userId: user.id,
    type: "withdraw",
    amount: String(amount),
    balanceAfter: String(newBalance),
    note: parsed.data.note,
  });

  res.json(
    WithdrawWalletResponse.parse({
      userId: user.id,
      balance: newBalance,
      depositTotal: 0,
      withdrawTotal: 0,
      winTotal: 0,
      bonusTotal: 0,
    })
  );
});

router.get("/wallet/transactions", requireAuth, async (req, res): Promise<void> => {
  const params = GetTransactionsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const user = (req as any).user;
  const { page = 1, limit = 20 } = params.data;

  const offset = (page - 1) * limit;
  const txs = await db
    .select()
    .from(transactionsTable)
    .where(eq(transactionsTable.userId, user.id))
    .orderBy(desc(transactionsTable.createdAt))
    .limit(limit)
    .offset(offset);

  const [{ total }] = await db
    .select({ total: count() })
    .from(transactionsTable)
    .where(eq(transactionsTable.userId, user.id));

  res.json(
    GetTransactionsResponse.parse({
      transactions: txs.map((t) => ({
        id: t.id,
        userId: t.userId,
        type: t.type,
        amount: Number(t.amount),
        balanceAfter: Number(t.balanceAfter),
        referenceId: t.referenceId ?? undefined,
        note: t.note ?? undefined,
        createdAt: t.createdAt.toISOString(),
      })),
      total: Number(total),
      page,
      limit,
    })
  );
});

export default router;
