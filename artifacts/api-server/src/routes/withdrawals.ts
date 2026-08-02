import { Router, type IRouter } from "express";
import { db, withdrawalsTable, usersTable, transactionsTable } from "@workspace/db";
import { eq, and, desc, count, like, sql } from "drizzle-orm";
import { requireAuth, requireAdmin, requireNotHold } from "../middlewares/auth";
import { createNotification } from "../lib/createNotification";

const router: IRouter = Router();

// ─── User endpoints ──────────────────────────────────────────────────────────

router.post("/withdrawals", requireAuth, requireNotHold, async (req, res): Promise<void> => {
  const user = (req as any).user;
  const { amount, upiId, bankAccount } = req.body;

  if (!amount || isNaN(Number(amount)) || Number(amount) < 500) {
    res.status(400).json({ error: "Minimum withdrawal amount is ₹500" });
    return;
  }
  if (!upiId && !bankAccount) {
    res.status(400).json({ error: "Provide either upiId or bankAccount details" });
    return;
  }

  // Calculate available balance (wallet - pending withdrawals)
  const [pendingResult] = await db
    .select({ total: sql<string>`coalesce(sum(amount::numeric), 0)` })
    .from(withdrawalsTable)
    .where(and(eq(withdrawalsTable.userId, user.id), eq(withdrawalsTable.status, "pending")));

  const pendingTotal = Number(pendingResult?.total ?? 0);
  const availableBalance = Number(user.walletBalance) - pendingTotal;
  const amt = Number(amount);

  if (availableBalance < amt) {
    res.status(400).json({
      error: `Insufficient available balance. Available: ₹${availableBalance.toFixed(0)} (wallet: ₹${Number(user.walletBalance).toFixed(0)}, pending withdrawals: ₹${pendingTotal.toFixed(0)})`,
    });
    return;
  }

  const [withdrawal] = await db.insert(withdrawalsTable).values({
    userId: user.id,
    amount: String(amt),
    upiId: upiId ?? null,
    bankAccount: bankAccount ?? null,
    status: "pending",
  }).returning();

  await createNotification(user.id, "withdrawal_submitted",
    "Withdrawal Request Submitted",
    `Your withdrawal of ₹${amt.toFixed(0)} is under review. It will be processed within 24 hours.`
  );

  res.status(201).json(serializeWithdrawal(withdrawal));
});

router.get("/withdrawals/my", requireAuth, async (req, res): Promise<void> => {
  const user = (req as any).user;
  const page = Number(req.query["page"] ?? 1);
  const limit = Number(req.query["limit"] ?? 20);
  const offset = (page - 1) * limit;

  const withdrawals = await db
    .select()
    .from(withdrawalsTable)
    .where(eq(withdrawalsTable.userId, user.id))
    .orderBy(desc(withdrawalsTable.createdAt))
    .limit(limit)
    .offset(offset);

  const [{ total }] = await db
    .select({ total: count() })
    .from(withdrawalsTable)
    .where(eq(withdrawalsTable.userId, user.id));

  res.json({
    withdrawals: withdrawals.map(serializeWithdrawal),
    total: Number(total),
    page,
    limit,
  });
});

// ─── Admin endpoints ──────────────────────────────────────────────────────────

router.get("/admin/withdrawals", requireAdmin, async (req, res): Promise<void> => {
  const status = req.query["status"] as string | undefined;
  const search = req.query["search"] as string | undefined;
  const page = Number(req.query["page"] ?? 1);
  const limit = Number(req.query["limit"] ?? 50);
  const offset = (page - 1) * limit;

  const conditions: any[] = [];
  if (status) conditions.push(eq(withdrawalsTable.status, status as any));
  if (search) conditions.push(like(usersTable.phone, `%${search}%`));

  const withdrawals = await db
    .select({
      withdrawal: withdrawalsTable,
      user: { id: usersTable.id, phone: usersTable.phone, name: usersTable.name, walletBalance: usersTable.walletBalance },
    })
    .from(withdrawalsTable)
    .leftJoin(usersTable, eq(withdrawalsTable.userId, usersTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(withdrawalsTable.createdAt))
    .limit(limit)
    .offset(offset);

  const [{ total }] = await db
    .select({ total: count() })
    .from(withdrawalsTable)
    .leftJoin(usersTable, eq(withdrawalsTable.userId, usersTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  res.json({
    withdrawals: withdrawals.map(({ withdrawal, user }) => ({
      ...serializeWithdrawal(withdrawal),
      user: user ? { ...user, walletBalance: Number(user.walletBalance) } : null,
    })),
    total: Number(total),
    page,
    limit,
  });
});

router.post("/admin/withdrawals/:withdrawalId/approve", requireAdmin, async (req, res): Promise<void> => {
  const withdrawalId = req.params["withdrawalId"] as string;
  const { remarks } = req.body;

  // Pre-check existence before entering transaction (fast path for 404)
  const [withdrawalCheck] = await db.select({ id: withdrawalsTable.id, userId: withdrawalsTable.userId })
    .from(withdrawalsTable).where(eq(withdrawalsTable.id, withdrawalId));
  if (!withdrawalCheck) { res.status(404).json({ error: "Withdrawal not found" }); return; }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, withdrawalCheck.userId));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  let balanceAfter: number | null = null;

  try {
    await db.transaction(async (tx) => {
      // Atomic conditional update: only succeeds if status is still "pending".
      // This eliminates the TOCTOU race — concurrent approvals cannot both win.
      const [approved] = await tx
        .update(withdrawalsTable)
        .set({ status: "approved", remarks: remarks ?? null, approvedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(withdrawalsTable.id, withdrawalId), eq(withdrawalsTable.status, "pending")))
        .returning();

      if (!approved) {
        throw Object.assign(new Error("Withdrawal already processed"), { alreadyProcessed: true });
      }

      const amount = Number(approved.amount);
      const balanceBefore = Number(user.walletBalance);

      // Re-validate balance inside the transaction (prevents overdraft under concurrent load)
      if (balanceBefore < amount) {
        throw Object.assign(
          new Error("User has insufficient balance at approval time"),
          { insufficientBalance: true }
        );
      }

      balanceAfter = balanceBefore - amount;

      await tx.update(usersTable)
        .set({ walletBalance: String(balanceAfter), updatedAt: new Date() })
        .where(eq(usersTable.id, user.id));

      await tx.insert(transactionsTable).values({
        userId: user.id,
        type: "withdraw",
        amount: String(amount),
        balanceBefore: String(balanceBefore),
        balanceAfter: String(balanceAfter),
        referenceId: withdrawalId,
        note: `Withdrawal approved (UPI: ${approved.upiId ?? "bank transfer"})`,
      });
    });
  } catch (err: any) {
    if (err.alreadyProcessed) {
      res.status(400).json({ error: "Withdrawal already processed" });
      return;
    }
    if (err.insufficientBalance) {
      res.status(400).json({ error: "User has insufficient balance at approval time" });
      return;
    }
    throw err;
  }

  await createNotification(user.id, "withdrawal_approved",
    "Withdrawal Approved ✓",
    `Your withdrawal has been approved and processed.`
  );

  res.json({ success: true, balanceAfter });
});

router.post("/admin/withdrawals/:withdrawalId/reject", requireAdmin, async (req, res): Promise<void> => {
  const withdrawalId = req.params["withdrawalId"] as string;
  const { remarks } = req.body;

  const [withdrawal] = await db.select().from(withdrawalsTable).where(eq(withdrawalsTable.id, withdrawalId));
  if (!withdrawal) { res.status(404).json({ error: "Withdrawal not found" }); return; }
  if (withdrawal.status !== "pending") { res.status(400).json({ error: "Withdrawal already processed" }); return; }

  await db.update(withdrawalsTable).set({
    status: "rejected",
    remarks: remarks ?? "Rejected by admin",
    updatedAt: new Date(),
  }).where(eq(withdrawalsTable.id, withdrawalId));

  await createNotification(withdrawal.userId, "withdrawal_rejected",
    "Withdrawal Rejected",
    `Your withdrawal of ₹${Number(withdrawal.amount).toFixed(0)} was rejected. ${remarks ? `Reason: ${remarks}` : "Please contact support."}`
  );

  res.json({ success: true });
});

function serializeWithdrawal(w: any) {
  return {
    id: w.id,
    userId: w.userId,
    amount: Number(w.amount),
    upiId: w.upiId ?? undefined,
    bankAccount: w.bankAccount ?? undefined,
    status: w.status,
    remarks: w.remarks ?? undefined,
    createdAt: w.createdAt instanceof Date ? w.createdAt.toISOString() : w.createdAt,
    updatedAt: w.updatedAt instanceof Date ? w.updatedAt.toISOString() : w.updatedAt,
    approvedAt: w.approvedAt instanceof Date ? w.approvedAt.toISOString() : (w.approvedAt ?? undefined),
  };
}

export default router;
