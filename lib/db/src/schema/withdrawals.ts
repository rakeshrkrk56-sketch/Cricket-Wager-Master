import { pgTable, text, numeric, timestamp, pgEnum, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const withdrawalStatusEnum = pgEnum("withdrawal_status", ["pending", "approved", "rejected"]);

export const withdrawalsTable = pgTable("withdrawals", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => usersTable.id),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  upiId: text("upi_id"),
  bankAccount: jsonb("bank_account"), // { accountNumber, ifsc, holderName }
  status: withdrawalStatusEnum("status").notNull().default("pending"),
  remarks: text("remarks"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  approvedAt: timestamp("approved_at"),
});

export const insertWithdrawalSchema = createInsertSchema(withdrawalsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertWithdrawal = z.infer<typeof insertWithdrawalSchema>;
export type Withdrawal = typeof withdrawalsTable.$inferSelect;
