import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const auditLogsTable = pgTable("audit_logs", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  adminId: text("admin_id").notNull().references(() => usersTable.id),
  targetUserId: text("target_user_id").references(() => usersTable.id),
  action: text("action").notNull(),
  reason: text("reason"),
  prevStatus: text("prev_status"),
  newStatus: text("new_status"),
  metadata: text("metadata"), // JSON string for extra info
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type AuditLog = typeof auditLogsTable.$inferSelect;
