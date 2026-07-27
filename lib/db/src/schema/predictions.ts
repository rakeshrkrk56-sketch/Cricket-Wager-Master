import { pgTable, text, numeric, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { marketsTable } from "./markets";
import { matchesTable } from "./matches";

export const predictionStatusEnum = pgEnum("prediction_status", ["pending", "won", "lost", "refunded"]);
export const choiceEnum = pgEnum("choice", ["YES", "NO"]);

export const predictionsTable = pgTable("predictions", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => usersTable.id),
  marketId: text("market_id").notNull().references(() => marketsTable.id),
  matchId: text("match_id").notNull().references(() => matchesTable.id),
  question: text("question").notNull(),
  choice: choiceEnum("choice").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  potentialWin: numeric("potential_win", { precision: 12, scale: 2 }).notNull(),
  status: predictionStatusEnum("status").notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertPredictionSchema = createInsertSchema(predictionsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPrediction = z.infer<typeof insertPredictionSchema>;
export type Prediction = typeof predictionsTable.$inferSelect;
