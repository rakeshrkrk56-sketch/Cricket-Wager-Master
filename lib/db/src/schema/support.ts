import { pgTable, text, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const ticketCategoryEnum = pgEnum("ticket_category", [
  "deposit_issue",
  "withdrawal_issue",
  "prediction_issue",
  "kyc_issue",
  "account_issue",
  "technical_problem",
  "other",
]);

export const ticketStatusEnum = pgEnum("ticket_status", [
  "open",
  "in_progress",
  "resolved",
  "closed",
]);

export const supportTicketsTable = pgTable("support_tickets", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => usersTable.id),
  subject: text("subject").notNull(),
  category: ticketCategoryEnum("category").notNull(),
  description: text("description").notNull(),
  screenshotBase64: text("screenshot_base64"),
  status: ticketStatusEnum("status").notNull().default("open"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at"),
});

export const ticketMessagesTable = pgTable("ticket_messages", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  ticketId: text("ticket_id").notNull().references(() => supportTicketsTable.id),
  senderId: text("sender_id").references(() => usersTable.id),
  isAdmin: boolean("is_admin").notNull().default(false),
  message: text("message").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertSupportTicketSchema = createInsertSchema(supportTicketsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSupportTicket = z.infer<typeof insertSupportTicketSchema>;
export type SupportTicket = typeof supportTicketsTable.$inferSelect;

export const insertTicketMessageSchema = createInsertSchema(ticketMessagesTable).omit({ id: true, createdAt: true });
export type InsertTicketMessage = z.infer<typeof insertTicketMessageSchema>;
export type TicketMessage = typeof ticketMessagesTable.$inferSelect;
