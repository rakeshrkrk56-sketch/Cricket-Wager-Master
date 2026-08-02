import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const loginHistoryTable = pgTable("login_history", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => usersTable.id),
  ip: text("ip"),
  deviceInfo: text("device_info"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type LoginHistory = typeof loginHistoryTable.$inferSelect;
