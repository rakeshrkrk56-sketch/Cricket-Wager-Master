import { pgTable, text, numeric, timestamp, pgEnum, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const depositMethodEnum = pgEnum("deposit_method", ["upi_deeplink", "manual"]);
export const depositStatusEnum = pgEnum("deposit_status", ["pending", "approved", "rejected"]);

export const depositsTable = pgTable("deposits", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => usersTable.id),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  method: depositMethodEnum("method").notNull(),
  screenshotBase64: text("screenshot_base64"),
  utrNumber: text("utr_number"),
  screenshotHash: text("screenshot_hash"),
  status: depositStatusEnum("status").notNull().default("pending"),
  remarks: text("remarks"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  approvedAt: timestamp("approved_at"),
}, (table) => ({
  utrUnique: uniqueIndex("deposits_user_utr_unique").on(table.userId, table.utrNumber),
}));

export const insertDepositSchema = createInsertSchema(depositsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDeposit = z.infer<typeof insertDepositSchema>;
export type Deposit = typeof depositsTable.$inferSelect;
