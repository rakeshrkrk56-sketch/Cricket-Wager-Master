import { Router, type IRouter } from "express";
import { db, depositsTable, usersTable, transactionsTable, notificationsTable } from "@workspace/db";
import { eq, and, desc, count, like } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middlewares/auth";
import { createNotification } from "../lib/createNotification";
import crypto from "crypto";

const router: IRouter = Router();

// ─── User endpoints ──────────────────────────────────────────────────────────

router.post("/deposits", requireAuth, async (req, res): Promise<void> => {
  const user = (req as any).user;
  const { amount, method, utrNumber, screenshotBase64 } = req.body;

  if (!amount || isNaN(Number(amount)) || Number(amount) < 200) {
    res.status(400).json({ error: "Minimum deposit amount is ₹200" });
    return;
  }
  if (!method || !["upi_deeplink", "manual"].includes(method)) {
    res.status(400).json({ error: "Invalid method. Use 'upi_deeplink' or 'manual'" });
    return;
  }
  if (method === "manual") {
    if (!utrNumber) {
      res.status(400).json({ error: "UTR number is required for manual deposits" });
      return;
    }
    // Check duplicate UTR for this user
    const existing = await db
      .select()
      .from(depositsTable)
      .where(and(eq(depositsTable.userId, user.id), eq(depositsTable.utrNumber, utrNumber)));
    if (existing.length > 0) {
      res.status(409).json({ error: "This UTR number has already been submitted" });
      return;
    }
  }

  // Compute screenshot hash for dedup (if provided)
  let screenshotHash: string | undefined;
  if (screenshotBase64) {
    screenshotHash = crypto.createHash("sha256").update(screenshotBase64).digest("hex");
    // Check for duplicate screenshot hash
    const dupScreenshot = await db
      .select({ id: depositsTable.id })
      .from(depositsTable)
      .where(eq(depositsTable.screenshotHash, screenshotHash));
    if (dupScreenshot.length > 0) {
      res.status(409).json({ error: "This screenshot has already been submitted" });
      return;
    }
  }

  const [deposit] = await db.insert(depositsTable).values({
    userId: user.id,
    amount: String(Number(amount)),
    method: method as "upi_deeplink" | "manual",
    utrNumber: utrNumber ?? null,
    screenshotBase64: screenshotBase64 ?? null,
    screenshotHash: screenshotHash ?? null,
    status: "pending",
  }).returning();

  await createNotification(
    user.id,
    "deposit_submitted",
    "Deposit Request Submitted",
    `Your deposit of ₹${Number(amount).toFixed(0)} has been submitted and is under review.`
  );

  res.status(201).json(serializeDeposit(deposit));
});

router.get("/deposits/my", requireAuth, async (req, res): Promise<void> => {
  const user = (req as any).user;
  const page = Number(req.query["page"] ?? 1);
  const limit = Number(req.query["limit"] ?? 20);
  const offset = (page - 1) * limit;

  const deposits = await db
    .select()
    .from(depositsTable)
    .where(eq(depositsTable.userId, user.id))
    .orderBy(desc(depositsTable.createdAt))
    .limit(limit)
    .offset(offset);

  const [{ total }] = await db
    .select({ total: count() })
    .from(depositsTable)
    .where(eq(depositsTable.userId, user.id));

  res.json({
    deposits: deposits.map((d) => serializeDeposit(d, false)),
    total: Number(total),
    page,
    limit,
  });
});

// ─── Admin endpoints ──────────────────────────────────────────────────────────

router.get("/admin/deposits", requireAdmin, async (req, res): Promise<void> => {
  const status = req.query["status"] as string | undefined;
  const search = req.query["search"] as string | undefined;
  const page = Number(req.query["page"] ?? 1);
  const limit = Number(req.query["limit"] ?? 50);
  const offset = (page - 1) * limit;

  const conditions: any[] = [];
  if (status) conditions.push(eq(depositsTable.status, status as any));
  if (search) conditions.push(like(usersTable.phone, `%${search}%`));

  const deposits = await db
    .select({
      deposit: depositsTable,
      user: { id: usersTable.id, phone: usersTable.phone, name: usersTable.name },
    })
    .from(depositsTable)
    .leftJoin(usersTable, eq(depositsTable.userId, usersTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(depositsTable.createdAt))
    .limit(limit)
    .offset(offset);

  const [{ total }] = await db
    .select({ total: count() })
    .from(depositsTable)
    .leftJoin(usersTable, eq(depositsTable.userId, usersTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  res.json({
    deposits: deposits.map(({ deposit, user }) => ({
      ...serializeDeposit(deposit),
      user,
    })),
    total: Number(total),
    page,
    limit,
  });
});

router.post("/admin/deposits/:depositId/approve", requireAdmin, async (req, res): Promise<void> => {
  const depositId = req.params["depositId"] as string;
  const { remarks } = req.body;

  const [deposit] = await db.select().from(depositsTable).where(eq(depositsTable.id, depositId));
  if (!deposit) { res.status(404).json({ error: "Deposit not found" }); return; }
  if (deposit.status !== "pending") { res.status(400).json({ error: "Deposit already processed" }); return; }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, deposit.userId));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const balanceBefore = Number(user.walletBalance);
  const amount = Number(deposit.amount);
  const balanceAfter = balanceBefore + amount;

  // Atomic: update deposit, credit wallet, create transaction inside a single DB transaction
  await db.transaction(async (tx) => {
    await tx.update(depositsTable).set({
      status: "approved",
      remarks: remarks ?? null,
      approvedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(depositsTable.id, depositId));

    await tx.update(usersTable).set({ walletBalance: String(balanceAfter), updatedAt: new Date() }).where(eq(usersTable.id, user.id));

    await tx.insert(transactionsTable).values({
      userId: user.id,
      type: "deposit",
      amount: String(amount),
      balanceBefore: String(balanceBefore),
      balanceAfter: String(balanceAfter),
      referenceId: depositId,
      note: `Deposit approved (UTR: ${deposit.utrNumber ?? "N/A"})`,
    });
  });

  await createNotification(user.id, "deposit_approved",
    "Deposit Approved ✓",
    `Your deposit of ₹${amount.toFixed(0)} has been approved. Wallet credited.`
  );
  await createNotification(user.id, "wallet_credited",
    "Wallet Credited",
    `₹${amount.toFixed(0)} added to your wallet. New balance: ₹${balanceAfter.toFixed(0)}.`
  );

  res.json({ success: true, balanceAfter });
});

router.post("/admin/deposits/:depositId/reject", requireAdmin, async (req, res): Promise<void> => {
  const depositId = req.params["depositId"] as string;
  const { remarks } = req.body;

  const [deposit] = await db.select().from(depositsTable).where(eq(depositsTable.id, depositId));
  if (!deposit) { res.status(404).json({ error: "Deposit not found" }); return; }
  if (deposit.status !== "pending") { res.status(400).json({ error: "Deposit already processed" }); return; }

  await db.update(depositsTable).set({
    status: "rejected",
    remarks: remarks ?? "Rejected by admin",
    updatedAt: new Date(),
  }).where(eq(depositsTable.id, depositId));

  await createNotification(deposit.userId, "deposit_rejected",
    "Deposit Rejected",
    `Your deposit of ₹${Number(deposit.amount).toFixed(0)} was rejected. ${remarks ? `Reason: ${remarks}` : "Please contact support."}`
  );

  res.json({ success: true });
});

function serializeDeposit(d: any, includeScreenshot = true) {
  return {
    id: d.id,
    userId: d.userId,
    amount: Number(d.amount),
    method: d.method,
    utrNumber: d.utrNumber ?? undefined,
    hasScreenshot: !!d.screenshotBase64,
    screenshotBase64: includeScreenshot ? (d.screenshotBase64 ?? undefined) : undefined,
    status: d.status,
    remarks: d.remarks ?? undefined,
    createdAt: d.createdAt instanceof Date ? d.createdAt.toISOString() : d.createdAt,
    updatedAt: d.updatedAt instanceof Date ? d.updatedAt.toISOString() : d.updatedAt,
    approvedAt: d.approvedAt instanceof Date ? d.approvedAt.toISOString() : (d.approvedAt ?? undefined),
  };
}

export default router;
