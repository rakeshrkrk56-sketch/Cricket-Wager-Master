import { pgTable, text, timestamp, pgEnum, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const matchStatusEnum = pgEnum("match_status", ["upcoming", "live", "completed", "cancelled"]);

export const matchesTable = pgTable("matches", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  title: text("title"),
  team1: text("team1").notNull(),
  team2: text("team2").notNull(),
  tournament: text("tournament").notNull(),
  startTime: timestamp("start_time").notNull(),
  status: matchStatusEnum("status").notNull().default("upcoming"),
  cricApiMatchId: text("cric_api_match_id"),
  liveScore: jsonb("live_score"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertMatchSchema = createInsertSchema(matchesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertMatch = z.infer<typeof insertMatchSchema>;
export type Match = typeof matchesTable.$inferSelect;
