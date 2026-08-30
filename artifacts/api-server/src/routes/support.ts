import { Router, type IRouter, type Response } from "express";
import { db, supportTicketsTable, ticketMessagesTable, usersTable, transactionsTable } from "@workspace/db";
import { eq, and, desc, count, like, gte } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middlewares/auth";
import { createNotification } from "../lib/createNotification";

const router: IRouter = Router();
const SUPPORT_HOUR_MS = 60 * 60 * 1000;
const MESSAGE_COOLDOWN_MS = 10 * 1000;
const MAX_TICKETS_PER_HOUR = 3;
const MAX_MESSAGES_PER_HOUR = 30;
const MAX_MESSAGE_LENGTH = 2000;
const MAX_SCREENSHOT_BASE64_LENGTH = 7_000_000;

function rejectRateLimited(res: Response, message: string, retryAfterSeconds: number): void {
  res.setHeader("Retry-After", String(Math.max(1, Math.ceil(retryAfterSeconds))));
  res.status(429).json({ error: message, code: "SUPPORT_RATE_LIMITED" });
}

function isValidScreenshot(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const screenshot = value.trim();
  if (!screenshot || screenshot.length > MAX_SCREENSHOT_BASE64_LENGTH) return false;

  const commaIndex = screenshot.indexOf(",");
  if (screenshot.startsWith("data:")) {
    if (commaIndex < 0 || !/^data:image\/(?:jpeg|jpg|png);base64$/i.test(screenshot.slice(0, commaIndex))) {
      return false;
    }
    return /^[A-Za-z0-9+/=\s]+$/.test(screenshot.slice(commaIndex + 1));
  }

  return /^[A-Za-z0-9+/=\s]+$/.test(screenshot);
}

// ─── User: Create ticket ──────────────────────────────────────────────────────

router.post("/support/tickets", requireAuth, async (req, res): Promise<void> => {
  const user = (req as any).user;
  const { subject, category, description, screenshotBase64 } = req.body;

  if (!subject?.trim()) { res.status(400).json({ error: "Subject is required" }); return; }
  if (!description?.trim()) { res.status(400).json({ error: "Description is required" }); return; }
  if (description.trim().length > MAX_MESSAGE_LENGTH) {
    res.status(400).json({ error: `Description must be ${MAX_MESSAGE_LENGTH} characters or less` });
    return;
  }
  if (screenshotBase64 !== undefined && screenshotBase64 !== null && !isValidScreenshot(screenshotBase64)) {
    res.status(400).json({ error: "Screenshot must be a JPEG or PNG image smaller than 5 MB" });
    return;
  }

  const validCategories = ["deposit_issue", "withdrawal_issue", "prediction_issue", "kyc_issue", "account_issue", "technical_problem", "other"];
  if (!validCategories.includes(category)) { res.status(400).json({ error: "Invalid category" }); return; }

  const ticketWindowStart = new Date(Date.now() - SUPPORT_HOUR_MS);
  const [{ total: recentTicketCount }] = await db
    .select({ total: count() })
    .from(supportTicketsTable)
    .where(and(eq(supportTicketsTable.userId, user.id), gte(supportTicketsTable.createdAt, ticketWindowStart)));
  if (Number(recentTicketCount) >= MAX_TICKETS_PER_HOUR) {
    rejectRateLimited(res, "You have reached the support ticket limit. Please continue in your existing ticket.", 60 * 60);
    return;
  }

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

  if (typeof message !== "string" || !message.trim()) { res.status(400).json({ error: "Message is required" }); return; }
  if (message.trim().length > MAX_MESSAGE_LENGTH) {
    res.status(400).json({ error: `Message must be ${MAX_MESSAGE_LENGTH} characters or less` });
    return;
  }

  const [ticket] = await db.select().from(supportTicketsTable)
    .where(and(eq(supportTicketsTable.id, ticketId), eq(supportTicketsTable.userId, user.id)));
  if (!ticket) { res.status(404).json({ error: "Ticket not found" }); return; }
  if (ticket.status === "closed") { res.status(400).json({ error: "Ticket is closed" }); return; }

  const now = Date.now();
  const messageWindowStart = new Date(now - SUPPORT_HOUR_MS);
  const [lastMessage] = await db
    .select({ createdAt: ticketMessagesTable.createdAt })
    .from(ticketMessagesTable)
    .where(and(
      eq(ticketMessagesTable.ticketId, ticketId),
      eq(ticketMessagesTable.senderId, user.id),
      gte(ticketMessagesTable.createdAt, new Date(now - MESSAGE_COOLDOWN_MS)),
    ))
    .orderBy(desc(ticketMessagesTable.createdAt))
    .limit(1);
  if (lastMessage) {
    const retryAfter = (lastMessage.createdAt.getTime() + MESSAGE_COOLDOWN_MS - now) / 1000;
    rejectRateLimited(res, "Please wait a few seconds before sending another message.", retryAfter);
    return;
  }

  const [{ total: recentMessageCount }] = await db
    .select({ total: count() })
    .from(ticketMessagesTable)
    .innerJoin(supportTicketsTable, eq(ticketMessagesTable.ticketId, supportTicketsTable.id))
    .where(and(
      eq(supportTicketsTable.userId, user.id),
      eq(ticketMessagesTable.senderId, user.id),
      gte(ticketMessagesTable.createdAt, messageWindowStart),
    ));
  if (Number(recentMessageCount) >= MAX_MESSAGES_PER_HOUR) {
    rejectRateLimited(res, "You have reached the hourly message limit. Please try again later.", 60 * 60);
    return;
  }

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
