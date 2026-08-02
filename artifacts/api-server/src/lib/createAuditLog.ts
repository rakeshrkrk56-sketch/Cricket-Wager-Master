import { db, auditLogsTable } from "@workspace/db";

export async function createAuditLog(params: {
  adminId: string;
  targetUserId?: string;
  action: string;
  reason?: string;
  prevStatus?: string;
  newStatus?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await db.insert(auditLogsTable).values({
    adminId: params.adminId,
    targetUserId: params.targetUserId ?? null,
    action: params.action,
    reason: params.reason ?? null,
    prevStatus: params.prevStatus ?? null,
    newStatus: params.newStatus ?? null,
    metadata: params.metadata ? JSON.stringify(params.metadata) : null,
  });
}
