import { pgTable, text, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const kycDocTypeEnum = pgEnum("kyc_doc_type", [
  "govt_id",
  "selfie",
  "address_proof",
  "other",
]);

export const kycDocStatusEnum = pgEnum("kyc_doc_status", [
  "pending",
  "approved",
  "rejected",
  "more_info_requested",
]);

export const kycDocumentsTable = pgTable("kyc_documents", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => usersTable.id),
  docType: kycDocTypeEnum("doc_type").notNull(),
  label: text("label"),
  dataBase64: text("data_base64").notNull(),
  status: kycDocStatusEnum("status").notNull().default("pending"),
  adminNote: text("admin_note"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type KycDocument = typeof kycDocumentsTable.$inferSelect;
