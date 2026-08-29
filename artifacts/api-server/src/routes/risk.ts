import { Router, type IRouter } from "express";
import {
  db, usersTable, adminNotesTable, auditLogsTable,
  depositsTable, withdrawalsTable, predictionsTable,
  kycDocumentsTable, loginHistoryTable, supportTicketsTable, ticketMessagesTable,
  notificationsTable, transactionsTable,
} from "@workspace/db";
import { eq, desc, and, gte, lte, like, count, sql } from "drizzle-orm";
import { requireAdmin } from "../middlewares/auth";
import { createAuditLog } from "../lib/createAuditLog";

const router: IRouter = Router();

// ─── Admin Notes ─────────────────────────────────────────────────────────────

router.get("/admin/users/:userId/notes", requireAdmin, async (req, res): Promise<void> => {
  const userId = String(req.params["userId"]);
  const notes = await db
    .select({
      id: adminNotesTable.id,
      note: adminNotesTable.note,
      createdAt: adminNotesTable.createdAt,
      updatedAt: adminNotesTable.updatedAt,
      admin: { id: usersTable.id, phone: usersTable.phone, name: usersTable.name },
    })
    .from(adminNotesTable)
    .leftJoin(usersTable, eq(adminNotesTable.adminId, usersTable.id))
    .where(eq(adminNotesTable.userId, userId))
    .orderBy(desc(adminNotesTable.createdAt));

  res.json({
    notes: notes.map((n) => ({
      id: n.id,
      note: n.note,
      admin: n.admin,
      createdAt: n.createdAt instanceof Date ? n.createdAt.toISOString() : n.createdAt,
      updatedAt: n.updatedAt instanceof Date ? n.updatedAt.toISOString() : n.updatedAt,
    })),
  });
});

router.post("/admin/users/:userId/notes", requireAdmin, async (req, res): Promise<void> => {
  const admin = (req as any).user;
  const userId = String(req.params["userId"]);
  const { note } = req.body;

  if (!note || !String(note).trim()) {
    res.status(400).json({ error: "note is required" });
    return;
  }

  const [created] = await db
    .insert(adminNotesTable)
    .values({ adminId: admin.id as string, userId, note: String(note).trim() })
    .returning();

  res.status(201).json({
    id: created.id,
    note: created.note,
    adminId: created.adminId,
    createdAt: created.createdAt.toISOString(),
    updatedAt: created.updatedAt.toISOString(),
  });
});

router.delete("/admin/users/:userId/notes/:noteId", requireAdmin, async (req, res): Promise<void> => {
  const userId = String(req.params["userId"]);
  const noteId = String(req.params["noteId"]);

  const [deleted] = await db
    .delete(adminNotesTable)
    .where(and(eq(adminNotesTable.id, noteId), eq(adminNotesTable.userId, userId)))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Note not found" });
    return;
  }
  res.json({ success: true });
});

// ─── Activity Timeline ────────────────────────────────────────────────────────

router.get("/admin/users/:userId/timeline", requireAdmin, async (req, res): Promise<void> => {
  const userId = String(req.params["userId"]);

  const [logins, deposits, withdrawals, kyc, support, auditLogs] = await Promise.all([
    db.select().from(loginHistoryTable).where(eq(loginHistoryTable.userId, userId)).orderBy(desc(loginHistoryTable.createdAt)).limit(50),
    db.select().from(depositsTable).where(eq(depositsTable.userId, userId)).orderBy(desc(depositsTable.createdAt)).limit(50),
    db.select().from(withdrawalsTable).where(eq(withdrawalsTable.userId, userId)).orderBy(desc(withdrawalsTable.createdAt)).limit(50),
    db.select().from(kycDocumentsTable).where(eq(kycDocumentsTable.userId, userId)).orderBy(desc(kycDocumentsTable.createdAt)).limit(20),
    db.select().from(supportTicketsTable).where(eq(supportTicketsTable.userId, userId)).orderBy(desc(supportTicketsTable.createdAt)).limit(20),
    db.select({
      id: auditLogsTable.id,
      action: auditLogsTable.action,
      reason: auditLogsTable.reason,
      prevStatus: auditLogsTable.prevStatus,
      newStatus: auditLogsTable.newStatus,
      createdAt: auditLogsTable.createdAt,
      admin: { id: usersTable.id, phone: usersTable.phone, name: usersTable.name },
    })
      .from(auditLogsTable)
      .leftJoin(usersTable, eq(auditLogsTable.adminId, usersTable.id))
      .where(eq(auditLogsTable.targetUserId, userId))
      .orderBy(desc(auditLogsTable.createdAt))
      .limit(50),
  ]);

  const events: any[] = [
    ...logins.map((l) => ({
      id: l.id, type: "login", label: "Login", detail: l.deviceInfo ?? undefined, extra: { ip: l.ip },
      createdAt: l.createdAt instanceof Date ? l.createdAt.toISOString() : l.createdAt,
    })),
    ...deposits.map((d) => ({
      id: d.id, type: "deposit", label: `Deposit ₹${Number(d.amount).toFixed(0)}`, detail: d.status,
      extra: { method: d.method, utrNumber: d.utrNumber, status: d.status },
      createdAt: d.createdAt instanceof Date ? d.createdAt.toISOString() : d.createdAt,
    })),
    ...withdrawals.map((w) => ({
      id: w.id, type: "withdrawal", label: `Withdrawal ₹${Number(w.amount).toFixed(0)}`, detail: w.status,
      extra: { upiId: w.upiId, status: w.status },
      createdAt: w.createdAt instanceof Date ? w.createdAt.toISOString() : w.createdAt,
    })),
    ...kyc.map((k) => ({
      id: k.id, type: "kyc", label: `KYC Document: ${k.docType}`, detail: k.status,
      extra: { docType: k.docType, status: k.status, adminNote: k.adminNote },
      createdAt: k.createdAt instanceof Date ? k.createdAt.toISOString() : k.createdAt,
    })),
    ...support.map((s) => ({
      id: s.id, type: "support", label: `Support Ticket: ${s.subject ?? ""}`, detail: s.status,
      extra: { status: s.status },
      createdAt: s.createdAt instanceof Date ? s.createdAt.toISOString() : s.createdAt,
    })),
    ...auditLogs.map((a) => ({
      id: a.id, type: "admin_action", label: `Admin Action: ${a.action}`, detail: a.reason ?? undefined,
      extra: { prevStatus: a.prevStatus, newStatus: a.newStatus, admin: a.admin },
      createdAt: a.createdAt instanceof Date ? a.createdAt.toISOString() : a.createdAt,
    })),
  ];

  // Sort by createdAt descending
  events.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  res.json({ events });
});

// ─── Global Audit Logs ────────────────────────────────────────────────────────

router.get("/admin/audit-logs", requireAdmin, async (req, res): Promise<void> => {
  const page = Number(req.query["page"] ?? 1);
  const limit = Number(req.query["limit"] ?? 50);
  const offset = (page - 1) * limit;
  const targetUserId = req.query["userId"] as string | undefined;
  const adminId = req.query["adminId"] as string | undefined;
  const action = req.query["action"] as string | undefined;
  const from = req.query["from"] as string | undefined;
  const to = req.query["to"] as string | undefined;

  const conditions: ReturnType<typeof eq>[] = [];
  if (targetUserId) conditions.push(eq(auditLogsTable.targetUserId, targetUserId));
  if (adminId) conditions.push(eq(auditLogsTable.adminId, adminId));
  if (action) conditions.push(like(auditLogsTable.action, `%${action}%`));
  if (from) conditions.push(gte(auditLogsTable.createdAt, new Date(from)));
  if (to) conditions.push(lte(auditLogsTable.createdAt, new Date(to)));

  const where = conditions.length > 0 ? and(...(conditions as [ReturnType<typeof eq>, ...ReturnType<typeof eq>[]])) : undefined;

  // Raw join for admin user details — avoids self-join alias complexity
  const logs = await db
    .select({
      log: auditLogsTable,
      admin: { id: usersTable.id, phone: usersTable.phone, name: usersTable.name },
    })
    .from(auditLogsTable)
    .leftJoin(usersTable, eq(auditLogsTable.adminId, usersTable.id))
    .where(where)
    .orderBy(desc(auditLogsTable.createdAt))
    .limit(limit)
    .offset(offset);

  const [{ total }] = await db.select({ total: count() }).from(auditLogsTable).where(where);

  res.json({
    logs: logs.map(({ log, admin }) => ({
      id: log.id,
      action: log.action,
      reason: log.reason ?? undefined,
      prevStatus: log.prevStatus ?? undefined,
      newStatus: log.newStatus ?? undefined,
      metadata: log.metadata ? (() => { try { return JSON.parse(log.metadata!); } catch { return {}; } })() : undefined,
      targetUserId: log.targetUserId ?? undefined,
      admin,
      createdAt: log.createdAt instanceof Date ? log.createdAt.toISOString() : log.createdAt,
    })),
    total: Number(total),
    page,
    limit,
  });
});

// ─── Permanent Delete ─────────────────────────────────────────────────────────

router.delete("/admin/users/:userId", requireAdmin, async (req, res): Promise<void> => {
  const admin = (req as any).user;
  const userId = String(req.params["userId"]);
  const reason = req.body?.reason ? String(req.body.reason) : undefined;

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  if (user.role === "admin") {
    res.status(400).json({ error: "Cannot delete an admin account" });
    return;
  }

  // Audit log BEFORE deletion — must happen first since the user row will be gone
  await createAuditLog({
    adminId: admin.id as string,
    targetUserId: userId,
    action: "user_deleted",
    reason,
    prevStatus: user.status,
    metadata: { phone: user.phone, walletBalance: String(user.walletBalance) },
  }).catch(() => {});

  // Cascade delete in FK-safe order
  // 1. Null-out nullable FKs that reference this user (preserve audit trail)
  await db.update(auditLogsTable).set({ targetUserId: null } as any).where(eq(auditLogsTable.targetUserId, userId));

  // 2. Null-out senderId in ticket messages (message text is preserved for admin reference)
  await db.update(ticketMessagesTable).set({ senderId: null } as any).where(eq(ticketMessagesTable.senderId, userId));

  // 3. Delete all records that directly reference this user (leaf-first)
  await Promise.all([
    db.delete(notificationsTable).where(eq(notificationsTable.userId, userId)),
    db.delete(loginHistoryTable).where(eq(loginHistoryTable.userId, userId)),
    db.delete(kycDocumentsTable).where(eq(kycDocumentsTable.userId, userId)),
    db.delete(adminNotesTable).where(eq(adminNotesTable.userId, userId)),
    db.delete(transactionsTable).where(eq(transactionsTable.userId, userId)),
    db.delete(predictionsTable).where(eq(predictionsTable.userId, userId)),
    db.delete(withdrawalsTable).where(eq(withdrawalsTable.userId, userId)),
    db.delete(depositsTable).where(eq(depositsTable.userId, userId)),
  ]);

  // 4. Delete support ticket messages first, then tickets
  const tickets = await db.select({ id: supportTicketsTable.id }).from(supportTicketsTable).where(eq(supportTicketsTable.userId, userId));
  for (const ticket of tickets) {
    await db.delete(ticketMessagesTable).where(eq(ticketMessagesTable.ticketId, ticket.id));
  }
  await db.delete(supportTicketsTable).where(eq(supportTicketsTable.userId, userId));

  // 5. Finally delete the user
  await db.delete(usersTable).where(eq(usersTable.id, userId));

  res.json({ success: true });
});

export default router;
