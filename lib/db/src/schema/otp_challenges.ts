import { pgTable, text, integer, timestamp, index } from "drizzle-orm/pg-core";

export const otpChallengesTable = pgTable("otp_challenges", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  phone: text("phone").notNull(),
  codeHash: text("code_hash").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  attempts: integer("attempts").notNull().default(0),
  consumedAt: timestamp("consumed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  phoneCreatedAtIdx: index("otp_challenges_phone_created_at_idx").on(table.phone, table.createdAt),
}));