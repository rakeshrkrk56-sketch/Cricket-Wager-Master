import { boolean, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const gameConfigsTable = pgTable("game_configs", {
  id: text("id").primaryKey().default("default"),
  payoutBalanceMode: boolean("payout_balance_mode").notNull().default(false),
  onboardingBoostActive: boolean("onboarding_boost_active").notNull().default(false),
  targetFeeRate: integer("target_fee_rate").notNull().default(5),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type GameConfig = typeof gameConfigsTable.$inferSelect;