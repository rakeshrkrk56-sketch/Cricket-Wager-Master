import { Router, type IRouter } from "express";
import { db, usersTable, transactionsTable, depositsTable } from "@workspace/db";
import { eq, desc, count, and } from "drizzle-orm";
import { requireAuth, requireNotHold } from "../middlewares/auth";
import { getWalletAccounting } from "../lib/walletAccounting";
import {
  DepositWalletBody,
  WithdrawWalletBody,
  GetWalletResponse,
  GetTransactionsQueryParams,
  GetTransactionsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

async function getWalletResponse(userId: string, balance: number) {
  const accounting = await getWalletAccounting(db, userId, balance);
  const [approvedDeposit] = await db
    .select({ id: depositsTable.id })
    .from(depositsTable)
    .where(and(eq(depositsTable.userId, userId), eq(depositsTable.status, "approved")))
    .limit(1);

  return GetWalletResponse.parse({
    userId,
    balance,
    ...accounting,
    firstDepositBonusAvailable: !approvedDeposit,
    depositBonusPercent: 30,
    depositBonusThreshold: 100,
  });
}

router.get("/wallet", requireAuth, async (req, res): Promise<void> => {
  const user = (req as any).user;

  res.json(await getWalletResponse(user.id, Number(user.walletBalance)));
});

router.post("/wallet/deposit", requireAuth, async (req, res): Promise<void> => {
  const parsed = DepositWalletBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const user = (req as any).user;
  const amount = parsed.data.amount;
  const balanceBefore = Number(user.walletBalance);
  const newBalance = balanceBefore + amount;

  await db.update(usersTable).set({ walletBalance: String(newBalance) }).where(eq(usersTable.id, user.id));
  await db.insert(transactionsTable).values({
    userId: user.id,
    type: "deposit",
    amount: String(amount),
    balanceBefore: String(balanceBefore),
    balanceAfter: String(newBalance),
    note: parsed.data.note,
  });

  res.json(await getWalletResponse(user.id, newBalance));
});

router.post("/wallet/withdraw", requireAuth, requireNotHold, async (req, res): Promise<void> => {
  const parsed = WithdrawWalletBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const user = (req as any).user;
  const amount = parsed.data.amount;
  if (amount < 500) {
    res.status(400).json({ error: "Minimum withdrawal amount is ₹500" });
    return;
  }
  let newBalance = 0;

  try {
    await db.transaction(async (tx) => {
      const [lockedUser] = await tx
        .select({ id: usersTable.id, walletBalance: usersTable.walletBalance })
        .from(usersTable)
        .where(eq(usersTable.id, user.id))
        .for("update");

      if (!lockedUser) {
        throw Object.assign(new Error("User not found"), { userMissing: true });
      }

      const currentBalance = Number(lockedUser.walletBalance);
      const accounting = await getWalletAccounting(tx, lockedUser.id, currentBalance);
      if (accounting.withdrawableWinnings < amount) {
        throw Object.assign(
          new Error(`Only winnings can be withdrawn. Withdrawable winnings: ₹${accounting.withdrawableWinnings.toFixed(0)}`),
          { insufficientWinnings: true },
        );
      }

      newBalance = currentBalance - amount;
      await tx.update(usersTable)
        .set({ walletBalance: String(newBalance), updatedAt: new Date() })
        .where(eq(usersTable.id, lockedUser.id));
      await tx.insert(transactionsTable).values({
        userId: lockedUser.id,
        type: "withdraw",
        amount: String(amount),
        balanceBefore: String(currentBalance),
        balanceAfter: String(newBalance),
        note: parsed.data.note,
      });
    });
  } catch (err: any) {
    if (err.insufficientWinnings) {
      res.status(400).json({ error: err.message });
      return;
    }
    if (err.userMissing) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    throw err;
  }

  res.json(await getWalletResponse(user.id, newBalance));
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
        balanceBefore: t.balanceBefore != null ? Number(t.balanceBefore) : undefined,
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
