import { Router, type IRouter } from "express";
import { db, supportTicketsTable, ticketMessagesTable, usersTable, transactionsTable } from "@workspace/db";
import { eq, and, desc, count, like } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middlewares/auth";
import { createNotification } from "../lib/createNotification";

const router: IRouter = Router();

// ─── User: Create ticket ──────────────────────────────────────────────────────

router.post("/support/tickets", requireAuth, async (req, res): Promise<void> => {
  const user = (req as any).user;
  const { subject, category, description, screenshotBase64 } = req.body;

  if (!subject?.trim()) { res.status(400).json({ error: "Subject is required" }); return; }
  if (!description?.trim()) { res.status(400).json({ error: "Description is required" }); return; }

  const validCategories = ["deposit_issue", "withdrawal_issue", "prediction_issue", "kyc_issue", "account_issue", "technical_problem", "other"];
  if (!validCategories.includes(category)) { res.status(400).json({ error: "Invalid category" }); return; }

  const [ticket] = await db.insert(supportTicketsTable).values({
    userId: user.id,
    subject: subject.trim(),
    category,
    description: description.trim(),
    screenshotBase64: screenshotBase64 ?? null,
    status: "open",
  }).returning();

  // Auto-reply from system
  await db.insert(ticketMessagesTable).values({
    ticketId: ticket.id,
    senderId: null,
    isAdmin: true,
    message: `नमस्ते! आपकी टिकट #${ticket.id.slice(0, 8)} प्राप्त हुई है। हमारी टीम 30 मिनट में जवाब देगी।\n\nHello! Your ticket #${ticket.id.slice(0, 8)} has been received. Our team will respond within 30 minutes.`,
  });

  res.status(201).json(serializeTicket(ticket));
});

// ─── User: My tickets ─────────────────────────────────────────────────────────

router.get("/support/tickets/my", requireAuth, async (req, res): Promise<void> => {
  const user = (req as any).user;
  const page = Number(req.query["page"] ?? 1);
  const limit = Number(req.query["limit"] ?? 20);
  const offset = (page - 1) * limit;

  const tickets = await db
    .select()
    .from(supportTicketsTable)
    .where(eq(supportTicketsTable.userId, user.id))
    .orderBy(desc(supportTicketsTable.updatedAt))
    .limit(limit)
    .offset(offset);

  const [{ total }] = await db
    .select({ total: count() })
    .from(supportTicketsTable)
    .where(eq(supportTicketsTable.userId, user.id));

  res.json({ tickets: tickets.map((ticket) => serializeTicket(ticket)), total: Number(total), page, limit });
});

// ─── User: Ticket detail + messages ──────────────────────────────────────────

router.get("/support/tickets/:ticketId", requireAuth, async (req, res): Promise<void> => {
  const user = (req as any).user;
  const ticketId = req.params["ticketId"] as string;

  const [ticket] = await db.select().from(supportTicketsTable)
    .where(and(eq(supportTicketsTable.id, ticketId), eq(supportTicketsTable.userId, user.id)));
  if (!ticket) { res.status(404).json({ error: "Ticket not found" }); return; }

  const messages = await db
    .select()
    .from(ticketMessagesTable)
    .where(eq(ticketMessagesTable.ticketId, ticketId))
    .orderBy(ticketMessagesTable.createdAt);

  res.json({ ticket: serializeTicket(ticket, true), messages: messages.map(serializeMessage) });
});

// ─── User: Reply to ticket ────────────────────────────────────────────────────

router.post("/support/tickets/:ticketId/messages", requireAuth, async (req, res): Promise<void> => {
  const user = (req as any).user;
  const ticketId = req.params["ticketId"] as string;
  const { message } = req.body;

  if (!message?.trim()) { res.status(400).json({ error: "Message is required" }); return; }

  const [ticket] = await db.select().from(supportTicketsTable)
    .where(and(eq(supportTicketsTable.id, ticketId), eq(supportTicketsTable.userId, user.id)));
  if (!ticket) { res.status(404).json({ error: "Ticket not found" }); return; }
  if (ticket.status === "closed") { res.status(400).json({ error: "Ticket is closed" }); return; }

  const [msg] = await db.insert(ticketMessagesTable).values({
    ticketId,
    senderId: user.id,
    isAdmin: false,
    message: message.trim(),
  }).returning();

  await db.update(supportTicketsTable)
    .set({ updatedAt: new Date(), status: ticket.status === "resolved" ? "open" : ticket.status })
    .where(eq(supportTicketsTable.id, ticketId));

  res.status(201).json(serializeMessage(msg));
});

// ─── Admin: List all tickets ──────────────────────────────────────────────────

router.get("/admin/support/tickets", requireAdmin, async (req, res): Promise<void> => {
  const status = req.query["status"] as string | undefined;
  const category = req.query["category"] as string | undefined;
  const search = req.query["search"] as string | undefined;
  const page = Number(req.query["page"] ?? 1);
  const limit = Number(req.query["limit"] ?? 30);
  const offset = (page - 1) * limit;

  const conditions: any[] = [];
  if (status) conditions.push(eq(supportTicketsTable.status, status as any));
  if (category) conditions.push(eq(supportTicketsTable.category, category as any));
  if (search) conditions.push(like(usersTable.phone, `%${search}%`));

  const tickets = await db
    .select({
      ticket: supportTicketsTable,
      user: { id: usersTable.id, phone: usersTable.phone, name: usersTable.name },
    })
    .from(supportTicketsTable)
    .leftJoin(usersTable, eq(supportTicketsTable.userId, usersTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(supportTicketsTable.updatedAt))
    .limit(limit)
    .offset(offset);

  const [{ total }] = await db
    .select({ total: count() })
    .from(supportTicketsTable)
    .leftJoin(usersTable, eq(supportTicketsTable.userId, usersTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  res.json({
    tickets: tickets.map(({ ticket, user }) => ({ ...serializeTicket(ticket), user })),
    total: Number(total),
    page,
    limit,
  });
});

// ─── Admin: Ticket detail ─────────────────────────────────────────────────────

router.get("/admin/support/tickets/:ticketId", requireAdmin, async (req, res): Promise<void> => {
  const ticketId = req.params["ticketId"] as string;

  const [row] = await db
    .select({ ticket: supportTicketsTable, user: usersTable })
    .from(supportTicketsTable)
    .leftJoin(usersTable, eq(supportTicketsTable.userId, usersTable.id))
    .where(eq(supportTicketsTable.id, ticketId));

  if (!row) { res.status(404).json({ error: "Ticket not found" }); return; }

  const messages = await db
    .select()
    .from(ticketMessagesTable)
    .where(eq(ticketMessagesTable.ticketId, ticketId))
    .orderBy(ticketMessagesTable.createdAt);

  // Fetch user's recent transactions
  const recentTxs = await db
    .select()
    .from(transactionsTable)
    .where(eq(transactionsTable.userId, row.ticket.userId))
    .orderBy(desc(transactionsTable.createdAt))
    .limit(10);

  res.json({
    ticket: { ...serializeTicket(row.ticket, true), user: row.user ? serializeUser(row.user) : null },
    messages: messages.map(serializeMessage),
    recentTransactions: recentTxs.map((t) => ({
      id: t.id, type: t.type, amount: Number(t.amount), status: t.status,
      createdAt: t.createdAt instanceof Date ? t.createdAt.toISOString() : t.createdAt,
    })),
  });
});

// ─── Admin: Reply ─────────────────────────────────────────────────────────────

router.post("/admin/support/tickets/:ticketId/reply", requireAdmin, async (req, res): Promise<void> => {
  const adminUser = (req as any).user;
  const ticketId = req.params["ticketId"] as string;
  const { message } = req.body;

  if (!message?.trim()) { res.status(400).json({ error: "Message is required" }); return; }

  const [ticket] = await db.select().from(supportTicketsTable).where(eq(supportTicketsTable.id, ticketId));
  if (!ticket) { res.status(404).json({ error: "Ticket not found" }); return; }

  const [msg] = await db.insert(ticketMessagesTable).values({
    ticketId,
    senderId: adminUser.id,
    isAdmin: true,
    message: message.trim(),
  }).returning();

  await db.update(supportTicketsTable)
    .set({ updatedAt: new Date(), status: ticket.status === "open" ? "in_progress" : ticket.status })
    .where(eq(supportTicketsTable.id, ticketId));

  await createNotification(
    ticket.userId,
    "deposit_approved", // reusing closest type — "support_reply" not in enum yet
    "Support Reply Received",
    `Your ticket has a new reply. Open the app to view it.`
  );

  res.status(201).json(serializeMessage(msg));
});

// ─── Admin: Update status ─────────────────────────────────────────────────────

router.patch("/admin/support/tickets/:ticketId/status", requireAdmin, async (req, res): Promise<void> => {
  const ticketId = req.params["ticketId"] as string;
  const { status } = req.body;

  const validStatuses = ["open", "in_progress", "resolved", "closed"];
  if (!validStatuses.includes(status)) { res.status(400).json({ error: "Invalid status" }); return; }

  const [ticket] = await db.select().from(supportTicketsTable).where(eq(supportTicketsTable.id, ticketId));
  if (!ticket) { res.status(404).json({ error: "Ticket not found" }); return; }

  const [updated] = await db.update(supportTicketsTable)
    .set({
      status,
      updatedAt: new Date(),
      resolvedAt: status === "resolved" || status === "closed" ? new Date() : ticket.resolvedAt,
    })
    .where(eq(supportTicketsTable.id, ticketId))
    .returning();

  if (status === "resolved") {
    await createNotification(
      ticket.userId,
      "deposit_approved",
      "Ticket Resolved ✓",
      `Your support ticket "${ticket.subject}" has been resolved.`
    );
  }

  res.json(serializeTicket(updated));
});

// ─── Serializers ──────────────────────────────────────────────────────────────

function serializeTicket(t: any, includeScreenshot = false) {
  const serialized = {
    id: t.id,
    userId: t.userId,
    subject: t.subject,
    category: t.category,
    description: t.description,
    hasScreenshot: !!t.screenshotBase64,
    status: t.status,
    createdAt: t.createdAt instanceof Date ? t.createdAt.toISOString() : t.createdAt,
    updatedAt: t.updatedAt instanceof Date ? t.updatedAt.toISOString() : t.updatedAt,
    resolvedAt: t.resolvedAt instanceof Date ? t.resolvedAt.toISOString() : (t.resolvedAt ?? null),
  };
  return includeScreenshot
    ? { ...serialized, screenshotBase64: t.screenshotBase64 ?? null }
    : serialized;
}

function serializeMessage(m: any) {
  return {
    id: m.id,
    ticketId: m.ticketId,
    senderId: m.senderId ?? null,
    isAdmin: m.isAdmin,
    message: m.message,
    createdAt: m.createdAt instanceof Date ? m.createdAt.toISOString() : m.createdAt,
  };
}

function serializeUser(u: any) {
  return {
    id: u.id,
    phone: u.phone,
    name: u.name ?? null,
    walletBalance: Number(u.walletBalance),
    kycStatus: u.kycStatus,
    status: u.status,
    createdAt: u.createdAt instanceof Date ? u.createdAt.toISOString() : u.createdAt,
  };
}

export default router;
