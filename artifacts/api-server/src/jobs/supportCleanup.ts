import { and, isNotNull, lt } from "drizzle-orm";
import { db, supportTicketsTable } from "@workspace/db";
import { logger } from "../lib/logger";

const SUPPORT_SCREENSHOT_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

export async function deleteExpiredSupportScreenshots(): Promise<void> {
  const cutoff = new Date(Date.now() - SUPPORT_SCREENSHOT_RETENTION_MS);
  const deleted = await db
    .update(supportTicketsTable)
    .set({ screenshotBase64: null })
    .where(and(
      isNotNull(supportTicketsTable.screenshotBase64),
      lt(supportTicketsTable.createdAt, cutoff),
    ))
    .returning({ id: supportTicketsTable.id });

  if (deleted.length > 0) {
    logger.info(
      { deletedCount: deleted.length, cutoff: cutoff.toISOString() },
      "Expired support screenshots deleted",
    );
  }
}