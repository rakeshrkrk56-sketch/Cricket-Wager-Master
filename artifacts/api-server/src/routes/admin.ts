import { Router, type IRouter } from "express";
import { db, usersTable, transactionsTable, depositsTable, withdrawalsTable } from "@workspace/db";
import { eq, and, desc, count, sum, sql, like, gte } from "drizzle-orm";
import { requireAdmin } from "../middlewares/auth";
import { createNotification } from "../lib/createNotification";
import { createAuditLog } from "../lib/createAuditLog";
import {
  ListUsersQueryParams,
  ListUsersResponse,
  GetUserParams,
  GetUserResponse,
  UpdateUserParams,
  UpdateUserBody,
  UpdateUserResponse,
  GetAdminStatsResponse,
} from "@workspace/api-zod";

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

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const users = await db.select().from(usersTable).where(where).orderBy(desc(usersTable.createdAt)).limit(limit).offset(offset);
  const [{ total }] = await db.select({ total: count() }).from(usersTable).where(where);

  res.json(ListUsersResponse.parse({
    users: users.map(serializeUser),
    total: Number(total),
    page,
    limit,
  }));
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

  // Prediction history is retained in the database for data safety, but is no
  // longer read or calculated by the active account-management API.
  res.json(GetUserResponse.parse({
    ...serializeUser(user),
    totalPredictions: 0,
    totalWon: 0,
    totalLost: 0,
    totalAmountBet: 0,
    totalAmountWon: 0,
  }));
});

router.patch("/admin/users/:userId", requireAdmin, async (req, res): Promise<void> => {
  const admin = (req as any).user;
  const params = UpdateUserParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [existing] = await db.select().from(usersTable).where(eq(usersTable.id, params.data.userId));
  if (!existing) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const bodyParsed = UpdateUserBody.safeParse(req.body);
  if (!bodyParsed.success) {
    res.status(400).json({ error: bodyParsed.error.message });
    return;
  }

  const { status: newStatus, suspensionReason, kycStatus, name } = bodyParsed.data;
  if (newStatus === "suspended" && !suspensionReason?.trim()) {
    res.status(400).json({ error: "suspensionReason is required when suspending an account" });
    return;
  }

  const updates: any = { updatedAt: new Date() };
  if (newStatus) updates.status = newStatus;
  if (kycStatus) updates.kycStatus = kycStatus;
  if (name !== undefined) updates.name = name;
  if (newStatus === "suspended") updates.suspensionReason = suspensionReason?.trim();
  if (newStatus === "active" || newStatus === "hold") updates.suspensionReason = null;

  const [user] = await db.update(usersTable).set(updates).where(eq(usersTable.id, params.data.userId)).returning();
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  if (newStatus && newStatus !== existing.status) {
    await createAuditLog({
      adminId: admin.id,
      targetUserId: user.id,
      action: `status_changed_to_${newStatus}`,
      reason: suspensionReason?.trim(),
      prevStatus: existing.status,
      newStatus,
    }).catch(() => {});

    if (newStatus === "hold") {
      await createNotification(user.id, "account_held", "Account Under Review",
        "Your account has been placed on hold. Deposits remain available, while withdrawals are temporarily disabled. Please contact support."
      ).catch(() => {});
    } else if (newStatus === "suspended") {
      await createNotification(user.id, "account_suspended", "Account Suspended",
        `Your account has been suspended. Reason: ${suspensionReason?.trim() ?? "Violation of terms"}. Please contact support.`
      ).catch(() => {});
    } else if (newStatus === "active" && existing.status !== "active") {
      await createNotification(user.id, "account_restored", "Account Restored ✓",
        "Your account has been restored. All permissions are now active."
      ).catch(() => {});
    }
  }

  if (kycStatus && kycStatus !== existing.kycStatus) {
    await createAuditLog({
      adminId: admin.id,
      targetUserId: user.id,
      action: `kyc_status_changed_to_${kycStatus}`,
      prevStatus: existing.kycStatus,
      newStatus: kycStatus,
    }).catch(() => {});
  }

  res.json(UpdateUserResponse.parse({ ...serializeUser(user), suspensionReason: user.suspensionReason ?? undefined }));
});

// ─── User wallet & history ────────────────────────────────────────────────────

router.post("/admin/users/:userId/wallet/adjust", requireAdmin, async (req, res): Promise<void> => {
  const userId = req.params["userId"] as string;
  const { type, amount, reason } = req.body;

  if (!type || !["credit", "debit"].includes(type)) {
    res.status(400).json({ error: "type must be 'credit' or 'debit'" });
    return;
  }
  if (!amount || isNaN(Number(amount)) || Number(amount) < 1) {
    res.status(400).json({ error: "amount must be at least 1" });
    return;
  }
  if (!reason || !String(reason).trim()) {
    res.status(400).json({ error: "reason is required" });
    return;
  }

  const amt = Number(amount);
  let balanceBefore = 0;
  let balanceAfter = 0;

  const adjusted = await db.transaction(async (tx) => {
    const conditions = type === "debit"
      ? and(eq(usersTable.id, userId), gte(usersTable.walletBalance, String(amt)))
      : eq(usersTable.id, userId);
    const operation = type === "credit"
      ? sql`${usersTable.walletBalance} + ${String(amt)}::numeric`
      : sql`${usersTable.walletBalance} - ${String(amt)}::numeric`;

    const [updatedUser] = await tx.update(usersTable)
      .set({ walletBalance: operation, updatedAt: new Date() })
      .where(conditions)
      .returning({ walletBalance: usersTable.walletBalance });
    if (!updatedUser) return null;

    balanceAfter = Number(updatedUser.walletBalance);
    balanceBefore = type === "credit" ? balanceAfter - amt : balanceAfter + amt;
    await tx.insert(transactionsTable).values({
      userId,
      type: type === "credit" ? "bonus" : "withdraw",
      amount: String(amt),
      balanceBefore: String(balanceBefore),
      balanceAfter: String(balanceAfter),
      status: "completed",
      note: `Admin ${type}: ${String(reason).trim()}`,
    });
    return updatedUser;
  });

  if (!adjusted) {
    const [existingUser] = await db.select({ walletBalance: usersTable.walletBalance })
      .from(usersTable).where(eq(usersTable.id, userId));
    if (!existingUser) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.status(400).json({
      error: `Insufficient balance. Current: ₹${Number(existingUser.walletBalance).toFixed(0)}, debit: ₹${amt.toFixed(0)}`,
    });
    return;
  }

  await createNotification(
    userId,
    "wallet_credited",
    type === "credit" ? "Wallet Credited by Admin" : "Wallet Debited by Admin",
    type === "credit"
      ? `₹${amt.toFixed(0)} credited. Reason: ${String(reason).trim()}. New balance: ₹${balanceAfter.toFixed(0)}`
      : `₹${amt.toFixed(0)} debited. Reason: ${String(reason).trim()}. New balance: ₹${balanceAfter.toFixed(0)}`
  );

  res.json({ success: true, balanceBefore, balanceAfter, type, amount: amt });
});

router.get("/admin/users/:userId/deposits", requireAdmin, async (req, res): Promise<void> => {
  const userId = req.params["userId"] as string;
  const page = Number(req.query["page"] ?? 1);
  const limit = Number(req.query["limit"] ?? 20);
  const offset = (page - 1) * limit;
  const [user] = await db.select({ id: usersTable.id, phone: usersTable.phone, name: usersTable.name })
    .from(usersTable).where(eq(usersTable.id, userId));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const deposits = await db.select().from(depositsTable).where(eq(depositsTable.userId, userId))
    .orderBy(desc(depositsTable.createdAt)).limit(limit).offset(offset);
  const [{ total }] = await db.select({ total: count() }).from(depositsTable).where(eq(depositsTable.userId, userId));

  res.json({
    deposits: deposits.map((d: any) => ({
      id: d.id, userId: d.userId, amount: Number(d.amount), method: d.method,
      utrNumber: d.utrNumber ?? undefined, hasScreenshot: !!d.screenshotBase64 || !!d.screenshotHash,
      status: d.status, remarks: d.remarks ?? undefined,
      createdAt: d.createdAt instanceof Date ? d.createdAt.toISOString() : d.createdAt,
      updatedAt: d.updatedAt instanceof Date ? d.updatedAt.toISOString() : d.updatedAt,
      approvedAt: d.approvedAt instanceof Date ? d.approvedAt.toISOString() : (d.approvedAt ?? undefined),
      user,
    })),
    total: Number(total), page, limit,
  });
});

router.get("/admin/users/:userId/withdrawals", requireAdmin, async (req, res): Promise<void> => {
  const userId = req.params["userId"] as string;
  const page = Number(req.query["page"] ?? 1);
  const limit = Number(req.query["limit"] ?? 20);
  const offset = (page - 1) * limit;
  const [user] = await db.select({
    id: usersTable.id, phone: usersTable.phone, name: usersTable.name, walletBalance: usersTable.walletBalance,
  }).from(usersTable).where(eq(usersTable.id, userId));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const withdrawals = await db.select().from(withdrawalsTable).where(eq(withdrawalsTable.userId, userId))
    .orderBy(desc(withdrawalsTable.createdAt)).limit(limit).offset(offset);
  const [{ total }] = await db.select({ total: count() }).from(withdrawalsTable).where(eq(withdrawalsTable.userId, userId));

  res.json({
    withdrawals: withdrawals.map((w: any) => ({
      id: w.id, userId: w.userId, amount: Number(w.amount), upiId: w.upiId ?? undefined,
      bankAccount: w.bankAccount ?? undefined, status: w.status, remarks: w.remarks ?? undefined,
      createdAt: w.createdAt instanceof Date ? w.createdAt.toISOString() : w.createdAt,
      updatedAt: w.updatedAt instanceof Date ? w.updatedAt.toISOString() : w.updatedAt,
      approvedAt: w.approvedAt instanceof Date ? w.approvedAt.toISOString() : (w.approvedAt ?? undefined),
      user: { ...user, walletBalance: Number(user.walletBalance) },
    })),
    total: Number(total), page, limit,
  });
});

// Match, market, score and prediction endpoints are intentionally not mounted.
// Their historical tables remain untouched so existing account data is safe.

// ─── Account and payment stats ────────────────────────────────────────────────

router.get("/admin/stats", requireAdmin, async (_req, res): Promise<void> => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [
    [{ totalUsers }],
    [{ activeUsers }],
    [{ totalDepositsSum }],
    [{ totalWithdrawalsSum }],
    todayTxs,
    [{ pendingDepositsCount, pendingDepositsAmount }],
    [{ pendingWithdrawalsCount, pendingWithdrawalsAmount }],
  ] = await Promise.all([
    db.select({ totalUsers: count() }).from(usersTable),
    db.select({ activeUsers: count() }).from(usersTable).where(eq(usersTable.status, "active")),
    db.select({ totalDepositsSum: sql<string>`coalesce(sum(amount::numeric),0)` }).from(depositsTable).where(eq(depositsTable.status, "approved")),
    db.select({ totalWithdrawalsSum: sql<string>`coalesce(sum(amount::numeric),0)` }).from(withdrawalsTable).where(eq(withdrawalsTable.status, "approved")),
    db.select().from(transactionsTable).where(gte(transactionsTable.createdAt, today)),
    db.select({ pendingDepositsCount: count(), pendingDepositsAmount: sum(depositsTable.amount) }).from(depositsTable).where(eq(depositsTable.status, "pending")),
    db.select({ pendingWithdrawalsCount: count(), pendingWithdrawalsAmount: sum(withdrawalsTable.amount) }).from(withdrawalsTable).where(eq(withdrawalsTable.status, "pending")),
  ]);

  const todayDeposits = todayTxs.filter((t) => t.type === "deposit").reduce((s, t) => s + Number(t.amount), 0);
  const todayWithdrawals = todayTxs.filter((t) => t.type === "withdraw").reduce((s, t) => s + Number(t.amount), 0);
  const totalDeposits = Number(totalDepositsSum);
  const totalWithdrawals = Number(totalWithdrawalsSum);
  const pendingDeposits = Number(pendingDepositsCount);
  const pendingWithdrawals = Number(pendingWithdrawalsCount);

  res.json(GetAdminStatsResponse.parse({
    totalUsers: Number(totalUsers),
    activeUsers: Number(activeUsers),
    // Retained response fields are zero for clients that have not regenerated
    // yet. No match or prediction tables are queried.
    totalMatches: 0,
    liveMatches: 0,
    totalPredictions: 0,
    pendingPredictions: 0,
    totalVolume: 0,
    totalPayout: 0,
    platformRevenue: 0,
    todayDeposits,
    todayWithdrawals,
    todayBets: 0,
    todayProfit: todayDeposits - todayWithdrawals,
    totalDeposits,
    totalWithdrawals,
    pendingDeposits,
    pendingWithdrawals,
    predictionSuccessRate: 0,
    pendingDepositsCount: pendingDeposits,
    pendingDepositsAmount: Number(pendingDepositsAmount ?? 0),
    pendingWithdrawalsCount: pendingWithdrawals,
    pendingWithdrawalsAmount: Number(pendingWithdrawalsAmount ?? 0),
  }));
});

router.get("/admin/stats/chart", requireAdmin, async (req, res): Promise<void> => {
  const days = Math.min(Math.max(Number(req.query["days"] ?? 30), 1), 90);
  const rows = await db.execute(sql`
    WITH date_series AS (
      SELECT generate_series(
        (now() - (${days} || ' days')::interval)::date,
        now()::date,
        '1 day'::interval
      )::date AS day
    ),
    daily_deposits AS (
      SELECT date_trunc('day', created_at)::date AS day, coalesce(sum(amount::numeric),0) AS amt
      FROM deposits WHERE status='approved' GROUP BY 1
    ),
    daily_withdrawals AS (
      SELECT date_trunc('day', created_at)::date AS day, coalesce(sum(amount::numeric),0) AS amt
      FROM withdrawals WHERE status='approved' GROUP BY 1
    )
    SELECT
      ds.day::text AS date,
      coalesce(dd.amt,0)::float AS deposits,
      coalesce(dw.amt,0)::float AS withdrawals,
      0::float AS bets,
      0::float AS revenue
    FROM date_series ds
    LEFT JOIN daily_deposits dd ON dd.day = ds.day
    LEFT JOIN daily_withdrawals dw ON dw.day = ds.day
    ORDER BY ds.day
  `);
  res.json({ data: rows.rows });
});

function serializeUser(u: any) {
  return {
    id: u.id,
    phone: u.phone,
    name: u.name ?? undefined,
    walletBalance: Number(u.walletBalance),
    kycStatus: u.kycStatus,
    status: u.status,
    suspensionReason: u.suspensionReason ?? undefined,
    role: u.role,
    createdAt: u.createdAt instanceof Date ? u.createdAt.toISOString() : u.createdAt,
  };
}

export default router;