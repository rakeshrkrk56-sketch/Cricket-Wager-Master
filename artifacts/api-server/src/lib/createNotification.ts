import { db, notificationsTable } from "@workspace/db";

export type NotificationType =
  | "deposit_submitted" | "deposit_approved" | "deposit_rejected"
  | "withdrawal_submitted" | "withdrawal_approved" | "withdrawal_rejected"
  | "prediction_won" | "prediction_lost" | "wallet_credited"
  | "account_held" | "account_suspended" | "account_restored"
  | "kyc_documents_required" | "kyc_approved" | "kyc_rejected";

export async function createNotification(
  userId: string,
  type: NotificationType,
  title: string,
  body: string
): Promise<void> {
  await db.insert(notificationsTable).values({ userId, type, title, body });
}
