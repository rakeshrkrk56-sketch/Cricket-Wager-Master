import {
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const dragonTigerRoundStatusEnum = pgEnum("dragon_tiger_round_status", [
  "BETTING",
  "REVEAL",
  "SETTLED",
]);
export const dragonTigerResultEnum = pgEnum("dragon_tiger_result", [
  "DRAGON",
  "TIGER",
  "TIE",
]);
export const dragonTigerBetStatusEnum = pgEnum("dragon_tiger_bet_status", [
  "PENDING",
  "WON",
  "LOST",
]);

export const dragonTigerRoundsTable = pgTable(
  "dragon_tiger_rounds",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    status: dragonTigerRoundStatusEnum("status").notNull().default("BETTING"),
    // A unique, nullable slot prevents two server processes from creating
    // concurrent active rounds. It is cleared only after settlement.
    activeSlot: integer("active_slot").default(1),
    dragonRank: integer("dragon_rank"),
    tigerRank: integer("tiger_rank"),
    result: dragonTigerResultEnum("result"),
    bettingClosesAt: timestamp("betting_closes_at").notNull(),
    revealEndsAt: timestamp("reveal_ends_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    settledAt: timestamp("settled_at"),
  },
  (table) => [
    uniqueIndex("dragon_tiger_rounds_active_slot_idx").on(table.activeSlot),
    index("dragon_tiger_rounds_created_at_idx").on(table.createdAt),
  ],
);

export const dragonTigerBetsTable = pgTable(
  "dragon_tiger_bets",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    roundId: text("round_id").notNull().references(() => dragonTigerRoundsTable.id),
    userId: text("user_id").notNull().references(() => usersTable.id),
    choice: dragonTigerResultEnum("choice").notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    payout: numeric("payout", { precision: 12, scale: 2 }).notNull().default("0"),
    status: dragonTigerBetStatusEnum("status").notNull().default("PENDING"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    settledAt: timestamp("settled_at"),
  },
  (table) => [
    index("dragon_tiger_bets_round_idx").on(table.roundId),
    index("dragon_tiger_bets_user_idx").on(table.userId),
  ],
);

export const insertDragonTigerRoundSchema = createInsertSchema(dragonTigerRoundsTable)
  .omit({ id: true, createdAt: true });
export const insertDragonTigerBetSchema = createInsertSchema(dragonTigerBetsTable)
  .omit({ id: true, createdAt: true });
export type DragonTigerRound = typeof dragonTigerRoundsTable.$inferSelect;
export type DragonTigerBet = typeof dragonTigerBetsTable.$inferSelect;
export type InsertDragonTigerRound = z.infer<typeof insertDragonTigerRoundSchema>;
export type InsertDragonTigerBet = z.infer<typeof insertDragonTigerBetSchema>;