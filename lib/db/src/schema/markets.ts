import { pgTable, text, numeric, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { matchesTable } from "./matches";

export const marketCategoryEnum = pgEnum("market_category", [
  "toss", "innings", "over", "batsman", "bowler", "match_winner"
]);
export const marketStatusEnum = pgEnum("market_status", [
  "open", "paused", "closed", "settled", "refunded"
]);
export const answerEnum = pgEnum("answer", ["YES", "NO"]);

export const marketsTable = pgTable("markets", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  matchId: text("match_id").notNull().references(() => matchesTable.id, { onDelete: "cascade" }),
  question: text("question").notNull(),
  questionHindi: text("question_hindi"),
  category: marketCategoryEnum("category").notNull(),
  yesPrice: numeric("yes_price", { precision: 6, scale: 2 }).notNull().default("1.90"),
  noPrice: numeric("no_price", { precision: 6, scale: 2 }).notNull().default("1.90"),
  yesPool: numeric("yes_pool", { precision: 12, scale: 2 }).notNull().default("0"),
  noPool: numeric("no_pool", { precision: 12, scale: 2 }).notNull().default("0"),
  status: marketStatusEnum("status").notNull().default("open"),
  correctAnswer: answerEnum("correct_answer"),
  totalYes: integer("total_yes").notNull().default(0),
  totalNo: integer("total_no").notNull().default(0),
  totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  settledAt: timestamp("settled_at"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertMarketSchema = createInsertSchema(marketsTable).omit({
  id: true, createdAt: true, updatedAt: true,
  totalYes: true, totalNo: true, totalAmount: true, yesPool: true, noPool: true
});
export type InsertMarket = z.infer<typeof insertMarketSchema>;
export type Market = typeof marketsTable.$inferSelect;
